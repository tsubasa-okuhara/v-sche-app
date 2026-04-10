"""
OCR（光学文字認識）ユーティリティモジュール
レシートテキスト抽出と情報パース

OCRエンジン:
  - EasyOCR（デフォルト）: 無料・無制限・オフライン対応
  - Google Cloud Vision API（オプション）: 高精度だが月1,000件まで無料
"""

import re
from datetime import datetime
from typing import Dict, Optional, Tuple, List
from PIL import Image, ImageOps, ImageEnhance, ExifTags
import io


# ===== 画像前処理 =====

def _fix_exif_rotation(image: Image.Image) -> Image.Image:
    """EXIF情報に基づいて画像の向きを修正"""
    try:
        exif = image._getexif()
        if exif:
            for tag, value in exif.items():
                if ExifTags.TAGS.get(tag) == 'Orientation':
                    if value == 3:
                        image = image.rotate(180, expand=True)
                    elif value == 6:
                        image = image.rotate(270, expand=True)
                    elif value == 8:
                        image = image.rotate(90, expand=True)
                    break
    except (AttributeError, TypeError):
        pass
    return image


def _preprocess_for_ocr(image: Image.Image) -> Image.Image:
    """OCR精度向上のための画像前処理"""
    # コントラスト強調
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)

    # シャープネス強調
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(2.0)

    return image


def _resize_for_ocr(image: Image.Image, max_side: int = 1500) -> Image.Image:
    """OCR用にリサイズ"""
    w, h = image.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return image


# ===== EasyOCR =====

def extract_text_easyocr(image_bytes: bytes) -> Optional[str]:
    """
    EasyOCRを使用してテキスト抽出（無料・無制限）

    - EXIF回転を自動補正
    - 4方向（0°/90°/180°/270°）を試して最も認識文字数が多い向きを採用
    - 画像は自動的にOCR向けサイズに縮小（高速化）

    Args:
        image_bytes: 画像のバイナリデータ

    Returns:
        抽出されたテキスト
    """
    try:
        import easyocr
        import numpy as np

        reader = easyocr.Reader(['ja', 'en'], gpu=False)

        image = Image.open(io.BytesIO(image_bytes))

        # EXIF回転を補正
        image = _fix_exif_rotation(image)

        # リサイズ + 前処理
        image = _resize_for_ocr(image, max_side=1200)
        image = _preprocess_for_ocr(image)

        # まず現在の向きで試す
        image_np = np.array(image)
        results = reader.readtext(image_np)
        best_text_parts = [text for (_, text, conf) in results if conf > 0.1]
        best_total_chars = sum(len(t) for t in best_text_parts)
        best_lines = best_text_parts

        # 文字数が少ない場合、90°回転を試す（横向き撮影対策）
        if best_total_chars < 20:
            for angle in [90, 270, 180]:
                rotated = image.rotate(angle, expand=True)
                rot_np = np.array(rotated)
                rot_results = reader.readtext(rot_np)
                rot_parts = [text for (_, text, conf) in rot_results if conf > 0.1]
                rot_chars = sum(len(t) for t in rot_parts)

                if rot_chars > best_total_chars:
                    best_total_chars = rot_chars
                    best_lines = rot_parts

                # 十分な文字数が取れたら終了
                if best_total_chars >= 30:
                    break

        return '\n'.join(best_lines)

    except ImportError:
        print("easyocrがインストールされていません。pip install easyocr を実行してください")
        return None
    except Exception as e:
        print(f"EasyOCR エラー: {str(e)}")
        return None


# ===== Google Cloud Vision API（オプション）=====

def extract_text_google_vision(image_bytes: bytes) -> Optional[str]:
    """
    Google Cloud Vision APIを使用してOCR抽出

    事前準備：
    1. pip install google-cloud-vision
    2. GOOGLE_APPLICATION_CREDENTIALS環境変数を設定

    Args:
        image_bytes: 画像のバイナリデータ

    Returns:
        抽出されたテキスト、エラーの場合はNone
    """
    try:
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.document_text_detection(image=image)
        text = response.full_text_annotation.text

        if response.error.message:
            print(f"Vision API エラー: {response.error.message}")
            return None

        return text

    except ImportError:
        print("google-cloud-vision がインストールされていません")
        return None
    except Exception as e:
        print(f"Google Vision API エラー: {str(e)}")
        return None


def extract_text(image_bytes: bytes, use_mock: bool = False) -> str:
    """
    OCRテキストを抽出

    優先順位: EasyOCR → Google Vision API → モック

    Args:
        image_bytes: 画像のバイナリデータ
        use_mock: Trueの場合はモックを強制使用

    Returns:
        抽出されたテキスト
    """
    if use_mock:
        return _mock_text()

    # EasyOCRを試す
    result = extract_text_easyocr(image_bytes)
    if result:
        return result

    # Google Vision APIを試す
    result = extract_text_google_vision(image_bytes)
    if result:
        return result

    # すべて失敗した場合
    return "[OCRエンジンが利用できません。pip install easyocr を実行してください]"


def _mock_text() -> str:
    """テスト用のモックテキスト"""
    return """コンビニエンスストア ABC
東京都渋谷区
2024年3月15日 14:23
商品A  980円
商品B  1,200円
合計  2,180円"""


# ===== テキスト解析ルーチン =====

def _normalize_ocr_text(text: str) -> str:
    """OCRテキストを正規化（行結合・全角→半角数字など）"""
    # 全角数字→半角
    zen = '０１２３４５６７８９'
    han = '0123456789'
    for z, h in zip(zen, han):
        text = text.replace(z, h)

    # 全角スラッシュ→半角
    text = text.replace('／', '/')

    # 改行をスペースに変換した版も作る（行をまたいだパターン検出用）
    return text


def parse_date(text: str) -> Optional[str]:
    """
    OCRテキストから日付を抽出

    対応形式:
    - YYYY年MM月DD日
    - YYYY/MM/DD
    - YYYY-MM-DD
    - 令和X年MM月DD日
    - R8.X.X
    """
    # テキスト正規化
    text = _normalize_ocr_text(text)

    # 改行をまたぐパターンにも対応するため、スペース結合版でも探す
    text_joined = text.replace('\n', ' ')
    search_texts = [text, text_joined]

    for t in search_texts:
        # パターン1: YYYY年MM月DD日
        match = re.search(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?', t)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # パターン2: YYYY/MM/DD
        match = re.search(r'(\d{4})\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})', t)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # パターン3: YYYY-MM-DD
        match = re.search(r'(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})', t)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # パターン4: 令和X年MM月DD日
        match = re.search(r'令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?', t)
        if match:
            reiwa_year, month, day = match.groups()
            year = 2018 + int(reiwa_year)
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # パターン5: R8.X.X または R8/X/X
        match = re.search(r'R\s*(\d{1,2})\s*[./\s]\s*(\d{1,2})\s*[./\s]\s*(\d{1,2})', t)
        if match:
            reiwa_year, month, day = match.groups()
            year = 2018 + int(reiwa_year)
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # パターン6: XX年MM月DD日（和暦の年だけ2桁）
        match = re.search(r'(\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?', t)
        if match:
            short_year, month, day = match.groups()
            year_int = int(short_year)
            if year_int <= 20:
                year = 2018 + year_int
            else:
                year = 2000 + year_int
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    return None

    return None


def parse_amount(text: str) -> Optional[float]:
    """
    OCRテキストから金額を抽出

    対応パターン:
    - 合計 ¥1,234 / 合計 1,234円
    - TOTAL ¥1,234
    - 税込 1,234円
    - 領収金額 ¥1,234
    - ¥1,234 / 1,234円 の全出現から最大値
    """
    text = _normalize_ocr_text(text)
    # 改行結合版でも検索
    text = text + '\n' + text.replace('\n', ' ')

    all_amounts = []

    # パターン群: 「合計」「税込」「領収」「TOTAL」など明示キーワードの後の金額
    keywords = [
        r'(?:合\s*計|TOTAL|total|Total)',
        r'(?:税\s*込)',
        r'(?:領\s*収)',
        r'(?:お\s*預\s*り)',
    ]

    for kw in keywords:
        # ¥記号あり: 合計 ¥1,234
        for m in re.finditer(kw + r'[^\d¥￥]*[¥￥]\s*([\d,]+)', text):
            try:
                all_amounts.append(('keyword', float(m.group(1).replace(',', ''))))
            except ValueError:
                pass
        # 円記号あり: 合計 1,234円
        for m in re.finditer(kw + r'[^\d]*([\d,]+)\s*円', text):
            try:
                all_amounts.append(('keyword', float(m.group(1).replace(',', ''))))
            except ValueError:
                pass

    # パターン: ¥に続く数字（全般）
    for m in re.finditer(r'[¥￥]\s*([\d,]+)', text):
        try:
            all_amounts.append(('yen', float(m.group(1).replace(',', ''))))
        except ValueError:
            pass

    # パターン: 数字+円（全般）
    for m in re.finditer(r'([\d,]+)\s*円', text):
        try:
            all_amounts.append(('en', float(m.group(1).replace(',', ''))))
        except ValueError:
            pass

    if not all_amounts:
        return None

    # キーワード付きがあればその中の最大値を返す（合計額の可能性が高い）
    keyword_amounts = [amt for tag, amt in all_amounts if tag == 'keyword']
    if keyword_amounts:
        return max(keyword_amounts)

    # なければ全金額の最大値（合計額は最大であることが多い）
    return max(amt for _, amt in all_amounts)


def parse_vendor(text: str) -> Optional[str]:
    """
    OCRテキストから取引先（店舗名等）を抽出

    戦略:
    1. 先頭の意味のある行を取得
    2. 日付・金額・住所っぽい行はスキップ
    """
    lines = text.split('\n')

    # スキップすべきパターン
    skip_patterns = [
        r'^\d{4}[/\-年]',              # 日付で始まる
        r'^R\d',                         # 令和略記
        r'^[¥￥]',                       # 金額で始まる
        r'^\d+円',                       # 金額
        r'^(合計|小計|税|TOTAL)',         # 金額キーワード
        r'^\d{2,4}[/\-]\d{1,2}[/\-]',  # 日付
        r'^(東京|大阪|京都|北海|神奈|千葉|埼玉|愛知|福岡)',  # 住所
        r'^\d+[\-ー]\d+',              # 電話番号・郵便番号
        r'^(TEL|FAX|tel|fax)',          # 電話
        r'^(〒|\d{3}-\d{4})',           # 郵便番号
        r'^(登録番号|インボイス)',        # インボイス関連
        r'^(レシート|領収|receipt)',      # レシートヘッダ
    ]

    for line in lines:
        line = line.strip()
        if not line or len(line) < 2:
            continue

        # スキップパターンに該当するか
        should_skip = False
        for pattern in skip_patterns:
            if re.match(pattern, line):
                should_skip = True
                break

        if not should_skip:
            # 長すぎる行は店名ではない可能性が高い
            if len(line) <= 30:
                return line

    return None


def extract_receipt_info_with_ai(ocr_text: str) -> Optional[Dict]:
    """
    Claude APIを使ってOCRテキストから情報を抽出（高精度）

    環境変数 ANTHROPIC_API_KEY が設定されている場合に使用

    Args:
        ocr_text: OCRで抽出された生テキスト

    Returns:
        抽出情報の辞書、またはNone（API未設定時）
    """
    import os
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')

    # Streamlit secrets からも取得
    if not api_key:
        try:
            import streamlit as st
            if hasattr(st, 'secrets') and 'anthropic' in st.secrets:
                api_key = st.secrets['anthropic'].get('api_key', '')
        except Exception:
            pass

    if not api_key:
        return None

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""以下のテキストは、レシートをOCR（文字認識）で読み取った生データです。
誤字脱字を補完し、必要な情報を抽出してください。

# 抽出項目
1. store_name: 店舗名（正式名称を推定）
2. date: 取引日（YYYY-MM-DD形式）
3. total_amount: 合計金額（税込、数値のみ）

# ルール
- 情報が見つからない場合は null としてください
- 合計金額は「合計」「税込」「領収額」などの最終金額を使ってください
- 必ず以下のJSON形式のみ出力してください（説明不要）

# OCRデータ
{ocr_text}

# 出力（JSONのみ）"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )

        # レスポンスからJSONを抽出
        import json
        response_text = message.content[0].text.strip()

        # JSON部分を抽出（```json ... ``` で囲まれている場合も対応）
        json_match = re.search(r'\{[^{}]+\}', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {
                'date': data.get('date'),
                'amount': float(data['total_amount']) if data.get('total_amount') else None,
                'vendor': data.get('store_name'),
                'raw_text': ocr_text
            }

    except ImportError:
        print("anthropic パッケージが未インストールです。pip install anthropic を実行してください")
    except Exception as e:
        print(f"Claude API エラー: {str(e)}")

    return None


def extract_receipt_info(ocr_text: str) -> Dict:
    """
    OCRテキストからレシート情報を抽出・パース

    優先順位: Claude API（高精度）→ ルールベース（フォールバック）

    Args:
        ocr_text: OCRで抽出されたテキスト

    Returns:
        抽出情報の辞書:
        {
            'date': '2024-03-15' or None,
            'amount': 2893.0 or None,
            'vendor': '店舗名' or None,
            'raw_text': ocr_text
        }
    """
    # まずClaude APIで解析を試みる
    ai_result = extract_receipt_info_with_ai(ocr_text)
    if ai_result:
        return ai_result

    # フォールバック: ルールベース解析
    return {
        'date': parse_date(ocr_text),
        'amount': parse_amount(ocr_text),
        'vendor': parse_vendor(ocr_text),
        'raw_text': ocr_text
    }
