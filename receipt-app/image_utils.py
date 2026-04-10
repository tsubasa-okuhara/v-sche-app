"""
画像検証・処理モジュール
電子帳簿保存法の要件に基づく画像品質チェック
"""

import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple, Optional
from PIL import Image, ExifTags
import io
import numpy as np

# 最小DPI要件
MIN_DPI = 200

# A6サイズの標準サイズ（mm）
A6_WIDTH_MM = 105
A6_HEIGHT_MM = 148

# 1インチ = 25.4mm
MM_PER_INCH = 25.4


def get_dpi_from_dimensions(width_px: int, height_px: int) -> int:
    """
    ピクセルサイズからDPIを推定（A6サイズと仮定）

    Args:
        width_px: 画像幅（ピクセル）
        height_px: 画像高さ（ピクセル）

    Returns:
        推定DPI値
    """
    # A6の標準サイズを想定して逆算
    dpi_width = (width_px / A6_WIDTH_MM) * MM_PER_INCH
    dpi_height = (height_px / A6_HEIGHT_MM) * MM_PER_INCH

    # 平均を取る
    return int((dpi_width + dpi_height) / 2)


def validate_image(uploaded_file) -> Dict:
    """
    アップロードされた画像をバリデーション

    Args:
        uploaded_file: Streamlitのアップロードファイルオブジェクト

    Returns:
        バリデーション結果の辞書:
        {
            'is_valid': bool,
            'dpi': int,
            'color_mode': str,
            'width': int,
            'height': int,
            'file_size': int,
            'errors': List[str],
            'warnings': List[str]
        }
    """
    errors = []
    warnings = []

    try:
        # 画像を開く
        image = Image.open(uploaded_file)
        image.load()  # 画像データを完全にロード

        width, height = image.size
        color_mode = image.mode
        file_size = uploaded_file.size if hasattr(uploaded_file, 'size') else len(uploaded_file.getvalue())

        # DPIを取得（EXIFデータから）
        exif_dpi = None
        if hasattr(image, 'info') and 'dpi' in image.info:
            dpi_tuple = image.info['dpi']
            exif_dpi = int(dpi_tuple[0]) if dpi_tuple else None

        # ピクセル寸法からの推定DPI（レシート＝A6サイズ想定）
        estimated_dpi = get_dpi_from_dimensions(width, height)

        # 判定: EXIF DPIが200以上ならそのまま採用
        # EXIF DPIが低くても（スマホは72dpi等）、ピクセル数が十分なら推定DPIを採用
        if exif_dpi and exif_dpi >= MIN_DPI:
            dpi = exif_dpi
        elif estimated_dpi >= MIN_DPI:
            dpi = estimated_dpi
            warnings.append(f"EXIF DPIは{exif_dpi or '不明'}ですが、画素数から実質{estimated_dpi}dpi相当と判定しました")
        else:
            dpi = exif_dpi or estimated_dpi

        # 画像形式チェック
        if image.format not in ['JPEG', 'JPG', 'PNG']:
            errors.append(f"非対応画像形式です: {image.format}")

        # DPIチェック（200dpi以上が要件）
        if dpi < MIN_DPI:
            errors.append(f"DPIが不足しています（最小: {MIN_DPI}dpi、現在: {dpi}dpi）")

        # 色モードチェック（RGB/RGBAが要件）
        if color_mode not in ['RGB', 'RGBA']:
            if color_mode == 'L':
                errors.append(f"グレースケール画像は受け付けません（RGB形式にしてください）")
            else:
                errors.append(f"非対応色モードです: {color_mode}")

        is_valid = len(errors) == 0

        return {
            'is_valid': is_valid,
            'dpi': dpi,
            'color_mode': color_mode,
            'width': width,
            'height': height,
            'file_size': file_size,
            'format': image.format,
            'errors': errors,
            'warnings': warnings
        }

    except Exception as e:
        return {
            'is_valid': False,
            'dpi': None,
            'color_mode': None,
            'width': None,
            'height': None,
            'file_size': None,
            'format': None,
            'errors': [f"画像解析エラー: {str(e)}"],
            'warnings': []
        }


def compute_hash(image_bytes: bytes) -> str:
    """
    画像データのSHA-256ハッシュを計算

    Args:
        image_bytes: 画像のバイナリデータ

    Returns:
        SHA-256ハッシュ値（16進数文字列）
    """
    return hashlib.sha256(image_bytes).hexdigest()


def save_image(image_bytes: bytes, receipt_id: int) -> str:
    """
    画像を保存（YYYY/MM フォルダ構造）

    Args:
        image_bytes: 画像のバイナリデータ
        receipt_id: レシートID

    Returns:
        保存されたファイルのパス（相対パス）
    """
    # 現在日時からフォルダ構造を作成
    now = datetime.now()
    year_month = now.strftime('%Y/%m')
    image_dir = Path('images') / year_month

    # ディレクトリを作成
    image_dir.mkdir(parents=True, exist_ok=True)

    # ファイル名を生成（receipt_id_timestamp.jpg）
    timestamp = now.strftime('%Y%m%d_%H%M%S')
    filename = f"receipt_{receipt_id}_{timestamp}.jpg"
    filepath = image_dir / filename

    # 画像を保存
    with open(filepath, 'wb') as f:
        f.write(image_bytes)

    # 相対パスを返す
    return str(filepath)


def get_image_path(relative_path: str) -> Optional[Path]:
    """
    画像の絶対パスを取得

    Args:
        relative_path: 相対パス

    Returns:
        絶対Pathオブジェクト、ファイルが存在しない場合はNone
    """
    filepath = Path(relative_path)

    if filepath.exists():
        return filepath

    return None


def load_image_for_display(relative_path: str) -> Optional[Image.Image]:
    """
    表示用に画像をロード

    Args:
        relative_path: 相対パス

    Returns:
        PILイメージオブジェクト、存在しない場合はNone
    """
    filepath = get_image_path(relative_path)

    if filepath is None:
        return None

    try:
        return Image.open(filepath)
    except Exception as e:
        print(f"画像ロードエラー: {str(e)}")
        return None


def auto_crop_receipt(image_bytes: bytes) -> bytes:
    """
    レシート部分を自動検出してクロップ（背景を除去）

    検出された四角形が画像全体の25%以上の場合のみクロップ。
    小さすぎる検出（文字やロゴの誤検出）は無視して元画像を返す。

    Args:
        image_bytes: 元画像のバイナリデータ

    Returns:
        クロップ済み画像のバイナリデータ（失敗時は元画像を返す）
    """
    try:
        import cv2

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return image_bytes

        orig = img.copy()
        h_orig, w_orig = img.shape[:2]
        img_area = h_orig * w_orig

        # 最小面積: 画像全体の25%以上でないとレシートとみなさない
        MIN_RECEIPT_RATIO = 0.25

        # 処理用にリサイズ（高速化）
        scale = 500.0 / max(h_orig, w_orig)
        resized = cv2.resize(img, None, fx=scale, fy=scale)
        resized_area = resized.shape[0] * resized.shape[1]

        # グレースケール → ぼかし → エッジ検出
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(gray, 50, 200)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edged = cv2.dilate(edged, kernel, iterations=2)

        contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return image_bytes

        # 面積順にソート
        contours = sorted(contours, key=cv2.contourArea, reverse=True)

        # 四角形を探す（面積が十分大きいもののみ）
        for c in contours[:5]:
            area = cv2.contourArea(c)

            # 面積が画像の25%未満なら小さすぎる→スキップ
            if area < resized_area * MIN_RECEIPT_RATIO:
                continue

            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)

            if len(approx) == 4:
                # 四角形が見つかった → 射影変換で正面補正
                pts = approx.reshape(4, 2).astype(np.float32) / scale
                rect = _order_points(pts)

                width_a = np.linalg.norm(rect[2] - rect[3])
                width_b = np.linalg.norm(rect[1] - rect[0])
                max_width = int(max(width_a, width_b))

                height_a = np.linalg.norm(rect[1] - rect[2])
                height_b = np.linalg.norm(rect[0] - rect[3])
                max_height = int(max(height_a, height_b))

                # クロップ後が小さすぎないかチェック
                if max_width * max_height < img_area * MIN_RECEIPT_RATIO:
                    continue

                dst = np.array([
                    [0, 0],
                    [max_width - 1, 0],
                    [max_width - 1, max_height - 1],
                    [0, max_height - 1]
                ], dtype=np.float32)

                M = cv2.getPerspectiveTransform(rect, dst)
                cropped = cv2.warpPerspective(orig, M, (max_width, max_height))

                success, buffer = cv2.imencode('.jpg', cropped, [cv2.IMWRITE_JPEG_QUALITY, 95])
                if success:
                    return buffer.tobytes()

        # 十分な大きさの四角形が見つからない → 元画像をそのまま返す
        return image_bytes

    except ImportError:
        # OpenCVがない場合は元画像をそのまま返す
        return image_bytes
    except Exception as e:
        print(f"自動クロップエラー: {str(e)}")
        return image_bytes


def _order_points(pts: np.ndarray) -> np.ndarray:
    """4つの頂点を 左上→右上→右下→左下 の順に整列"""
    rect = np.zeros((4, 2), dtype=np.float32)

    # 合計が最小 = 左上、最大 = 右下
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # 差が最小 = 右上、最大 = 左下
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]

    return rect
