"""
データベース層モジュール
電子帳簿保存法対応のレシート管理システム用のデータベース操作

バックエンド:
- ローカル開発: SQLite (receipt_database.db)
- 本番 (Streamlit Cloud): Supabase (PostgreSQL)

環境変数 SUPABASE_URL / SUPABASE_KEY または Streamlit secrets に
[supabase] セクションがあれば Supabase を使用。
"""

import os
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional

# デフォルト費目カテゴリー（日本の経費分類）
DEFAULT_CATEGORIES = [
    "交通費",
    "接待交際費",
    "消耗品費",
    "通信費",
    "水道光熱費",
    "地代家賃",
    "雑費",
    "その他"
]

DB_PATH = "receipt_database.db"


# ============================================================
# バックエンド判定: Supabase が使えるかどうか
# ============================================================

def _get_supabase_client():
    """Supabase クライアントを取得（設定が無い場合は None）"""
    url = None
    key = None

    # 1. 環境変数から取得
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

    # 2. Streamlit secrets から取得
    if not url or not key:
        try:
            import streamlit as st
            if hasattr(st, "secrets") and "supabase" in st.secrets:
                url = url or st.secrets["supabase"].get("url")
                key = key or st.secrets["supabase"].get("key")
        except Exception:
            pass

    if not url or not key:
        return None

    try:
        from supabase import create_client
        return create_client(url, key)
    except ImportError:
        return None
    except Exception as e:
        print(f"Supabase接続エラー: {e}")
        return None


def _use_supabase() -> bool:
    """Supabase を使用するかどうか"""
    return _get_supabase_client() is not None


# ============================================================
# SQLite 実装
# ============================================================

def _sqlite_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _sqlite_init():
    conn = _sqlite_conn()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_date TEXT NOT NULL,
            amount REAL NOT NULL,
            vendor TEXT,
            category TEXT NOT NULL,
            description TEXT,
            image_path TEXT,
            image_hash TEXT UNIQUE,
            image_dpi INTEGER,
            image_color_mode TEXT,
            scan_date TEXT NOT NULL,
            ocr_raw_text TEXT,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_by TEXT DEFAULT 'system'
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS receipt_audit_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id INTEGER,
            action TEXT NOT NULL,
            changed_column TEXT,
            old_value TEXT,
            new_value TEXT,
            changed_at TEXT NOT NULL,
            changed_by TEXT DEFAULT 'system',
            reason TEXT,
            FOREIGN KEY(receipt_id) REFERENCES receipts(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')

    cursor.execute('SELECT COUNT(*) FROM categories')
    if cursor.fetchone()[0] == 0:
        for cat in DEFAULT_CATEGORIES:
            cursor.execute('''
                INSERT INTO categories (name, is_active, created_at)
                VALUES (?, ?, ?)
            ''', (cat, 1, datetime.now().isoformat()))

    conn.commit()
    conn.close()


# ============================================================
# Supabase 実装
# ============================================================

def _supabase_init():
    """
    Supabase側はテーブルを SQL で事前に作成しておく必要があります。
    supabase_schema.sql を Supabase SQL Editor で実行してください。
    ここではカテゴリーの初期データのみ投入。
    """
    client = _get_supabase_client()
    if client is None:
        return

    try:
        res = client.table("categories").select("id").limit(1).execute()
        if not res.data:
            now = datetime.now().isoformat()
            rows = [{"name": c, "is_active": True, "created_at": now} for c in DEFAULT_CATEGORIES]
            client.table("categories").insert(rows).execute()
    except Exception as e:
        print(f"Supabase初期化警告: {e}")


# ============================================================
# 公開API (SQLite / Supabase を自動切替)
# ============================================================

def get_db_connection():
    """後方互換のためのSQLite接続取得（直接呼ぶのは非推奨）"""
    return _sqlite_conn()


def init_db():
    """データベースを初期化"""
    if _use_supabase():
        _supabase_init()
    else:
        _sqlite_init()


def insert_receipt(
    transaction_date: str,
    amount: float,
    vendor: str,
    category: str,
    description: str,
    image_path: str,
    image_hash: str,
    image_dpi: int,
    image_color_mode: str,
    ocr_raw_text: str = None,
    created_by: str = "system"
) -> int:
    """新規レシートを登録"""
    now = datetime.now().isoformat()

    client = _get_supabase_client()
    if client is not None:
        try:
            res = client.table("receipts").insert({
                "transaction_date": transaction_date,
                "amount": amount,
                "vendor": vendor,
                "category": category,
                "description": description,
                "image_path": image_path,
                "image_hash": image_hash,
                "image_dpi": image_dpi,
                "image_color_mode": image_color_mode,
                "scan_date": now,
                "ocr_raw_text": ocr_raw_text,
                "is_deleted": False,
                "created_at": now,
                "updated_at": now,
                "created_by": created_by,
            }).execute()
            receipt_id = res.data[0]["id"]

            client.table("receipt_audit_log").insert({
                "receipt_id": receipt_id,
                "action": "INSERT",
                "changed_at": now,
                "changed_by": created_by,
                "reason": "初回登録",
            }).execute()
            return receipt_id
        except Exception as e:
            msg = str(e)
            if "duplicate" in msg.lower() or "unique" in msg.lower():
                raise ValueError(f"重複するハッシュ値です: {msg}")
            raise

    # SQLite
    conn = _sqlite_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO receipts
            (transaction_date, amount, vendor, category, description,
             image_path, image_hash, image_dpi, image_color_mode,
             scan_date, ocr_raw_text, created_at, updated_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            transaction_date, amount, vendor, category, description,
            image_path, image_hash, image_dpi, image_color_mode,
            now, ocr_raw_text, now, now, created_by
        ))
        receipt_id = cursor.lastrowid

        cursor.execute('''
            INSERT INTO receipt_audit_log
            (receipt_id, action, changed_at, changed_by, reason)
            VALUES (?, ?, ?, ?, ?)
        ''', (receipt_id, 'INSERT', now, created_by, '初回登録'))

        conn.commit()
        return receipt_id
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise ValueError(f"重複するハッシュ値です: {str(e)}")
    finally:
        conn.close()


def update_receipt(
    receipt_id: int,
    transaction_date: str = None,
    amount: float = None,
    vendor: str = None,
    category: str = None,
    description: str = None,
    reason: str = "",
    updated_by: str = "system"
) -> bool:
    """既存レシートを更新（監査ログ記録付き）"""
    now = datetime.now().isoformat()

    client = _get_supabase_client()
    if client is not None:
        try:
            res = client.table("receipts").select("*").eq("id", receipt_id).eq("is_deleted", False).execute()
            if not res.data:
                return False
            current = res.data[0]

            updates = {}
            if transaction_date is not None and transaction_date != current["transaction_date"]:
                updates["transaction_date"] = transaction_date
            if amount is not None and amount != current["amount"]:
                updates["amount"] = amount
            if vendor is not None and vendor != current["vendor"]:
                updates["vendor"] = vendor
            if category is not None and category != current["category"]:
                updates["category"] = category
            if description is not None and description != current["description"]:
                updates["description"] = description

            if not updates:
                return True

            updates["updated_at"] = now
            client.table("receipts").update(updates).eq("id", receipt_id).execute()

            log_rows = []
            for col, new_val in updates.items():
                if col == "updated_at":
                    continue
                log_rows.append({
                    "receipt_id": receipt_id,
                    "action": "UPDATE",
                    "changed_column": col,
                    "old_value": str(current.get(col)),
                    "new_value": str(new_val),
                    "changed_at": now,
                    "changed_by": updated_by,
                    "reason": reason,
                })
            if log_rows:
                client.table("receipt_audit_log").insert(log_rows).execute()
            return True
        except Exception as e:
            print(f"Supabase更新エラー: {e}")
            return False

    # SQLite
    conn = _sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM receipts WHERE id = ? AND is_deleted = 0', (receipt_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    current_values = dict(row)
    updates = {}
    if transaction_date is not None and transaction_date != current_values['transaction_date']:
        updates['transaction_date'] = transaction_date
    if amount is not None and amount != current_values['amount']:
        updates['amount'] = amount
    if vendor is not None and vendor != current_values['vendor']:
        updates['vendor'] = vendor
    if category is not None and category != current_values['category']:
        updates['category'] = category
    if description is not None and description != current_values['description']:
        updates['description'] = description

    if not updates:
        conn.close()
        return True

    set_clause = ', '.join([f'{col} = ?' for col in updates.keys()])
    values = list(updates.values()) + [now, receipt_id]
    cursor.execute(f'''
        UPDATE receipts
        SET {set_clause}, updated_at = ?
        WHERE id = ?
    ''', values)

    for column, new_value in updates.items():
        cursor.execute('''
            INSERT INTO receipt_audit_log
            (receipt_id, action, changed_column, old_value, new_value, changed_at, changed_by, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            receipt_id, 'UPDATE', column,
            str(current_values[column]), str(new_value),
            now, updated_by, reason
        ))

    conn.commit()
    conn.close()
    return True


def soft_delete_receipt(receipt_id: int, reason: str = "", deleted_by: str = "system") -> bool:
    """レシートを論理削除（物理削除は禁止）"""
    now = datetime.now().isoformat()

    client = _get_supabase_client()
    if client is not None:
        try:
            res = client.table("receipts").select("is_deleted").eq("id", receipt_id).execute()
            if not res.data or res.data[0]["is_deleted"]:
                return False

            client.table("receipts").update({
                "is_deleted": True,
                "updated_at": now,
            }).eq("id", receipt_id).execute()

            client.table("receipt_audit_log").insert({
                "receipt_id": receipt_id,
                "action": "DELETE",
                "changed_at": now,
                "changed_by": deleted_by,
                "reason": reason,
            }).execute()
            return True
        except Exception as e:
            print(f"Supabase削除エラー: {e}")
            return False

    conn = _sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT is_deleted FROM receipts WHERE id = ?', (receipt_id,))
    row = cursor.fetchone()
    if not row or row['is_deleted'] == 1:
        conn.close()
        return False

    cursor.execute('''
        UPDATE receipts
        SET is_deleted = 1, updated_at = ?
        WHERE id = ?
    ''', (now, receipt_id))

    cursor.execute('''
        INSERT INTO receipt_audit_log
        (receipt_id, action, changed_at, changed_by, reason)
        VALUES (?, ?, ?, ?, ?)
    ''', (receipt_id, 'DELETE', now, deleted_by, reason))

    conn.commit()
    conn.close()
    return True


def search_receipts(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    vendor: Optional[str] = None
) -> List[Dict]:
    """レシートを検索"""
    client = _get_supabase_client()
    if client is not None:
        try:
            q = client.table("receipts").select("*").eq("is_deleted", False)
            if date_from:
                q = q.gte("transaction_date", date_from)
            if date_to:
                q = q.lte("transaction_date", date_to)
            if amount_min is not None:
                q = q.gte("amount", amount_min)
            if amount_max is not None:
                q = q.lte("amount", amount_max)
            if vendor:
                q = q.ilike("vendor", f"%{vendor}%")
            q = q.order("transaction_date", desc=True)
            res = q.execute()
            return res.data or []
        except Exception as e:
            print(f"Supabase検索エラー: {e}")
            return []

    conn = _sqlite_conn()
    cursor = conn.cursor()
    query = 'SELECT * FROM receipts WHERE is_deleted = 0'
    params = []
    if date_from:
        query += ' AND transaction_date >= ?'
        params.append(date_from)
    if date_to:
        query += ' AND transaction_date <= ?'
        params.append(date_to)
    if amount_min is not None:
        query += ' AND amount >= ?'
        params.append(amount_min)
    if amount_max is not None:
        query += ' AND amount <= ?'
        params.append(amount_max)
    if vendor:
        query += ' AND vendor LIKE ?'
        params.append(f'%{vendor}%')
    query += ' ORDER BY transaction_date DESC'

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_receipt_by_id(receipt_id: int) -> Optional[Dict]:
    """IDでレシートを取得"""
    client = _get_supabase_client()
    if client is not None:
        try:
            res = client.table("receipts").select("*").eq("id", receipt_id).eq("is_deleted", False).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            print(f"Supabase取得エラー: {e}")
            return None

    conn = _sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM receipts WHERE id = ? AND is_deleted = 0', (receipt_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_audit_log(receipt_id: Optional[int] = None) -> List[Dict]:
    """監査ログを取得"""
    client = _get_supabase_client()
    if client is not None:
        try:
            q = client.table("receipt_audit_log").select("*")
            if receipt_id:
                q = q.eq("receipt_id", receipt_id)
            q = q.order("changed_at", desc=True)
            res = q.execute()
            return res.data or []
        except Exception as e:
            print(f"Supabase監査ログ取得エラー: {e}")
            return []

    conn = _sqlite_conn()
    cursor = conn.cursor()
    if receipt_id:
        cursor.execute('''
            SELECT * FROM receipt_audit_log
            WHERE receipt_id = ?
            ORDER BY changed_at DESC
        ''', (receipt_id,))
    else:
        cursor.execute('''
            SELECT * FROM receipt_audit_log
            ORDER BY changed_at DESC
        ''')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_categories(active_only: bool = True) -> List[str]:
    """カテゴリー一覧を取得"""
    client = _get_supabase_client()
    if client is not None:
        try:
            q = client.table("categories").select("name")
            if active_only:
                q = q.eq("is_active", True)
            q = q.order("name")
            res = q.execute()
            return [row["name"] for row in (res.data or [])]
        except Exception as e:
            print(f"Supabaseカテゴリー取得エラー: {e}")
            return list(DEFAULT_CATEGORIES)

    conn = _sqlite_conn()
    cursor = conn.cursor()
    if active_only:
        cursor.execute('SELECT name FROM categories WHERE is_active = 1 ORDER BY name')
    else:
        cursor.execute('SELECT name FROM categories ORDER BY name')
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]


def get_unique_vendors() -> List[str]:
    """登録されている全ユニークな取引先を取得"""
    client = _get_supabase_client()
    if client is not None:
        try:
            res = client.table("receipts").select("vendor").eq("is_deleted", False).execute()
            vendors = set()
            for row in (res.data or []):
                if row.get("vendor"):
                    vendors.add(row["vendor"])
            return sorted(vendors)
        except Exception as e:
            print(f"Supabase取引先取得エラー: {e}")
            return []

    conn = _sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT vendor FROM receipts
        WHERE is_deleted = 0 AND vendor IS NOT NULL
        ORDER BY vendor
    ''')
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows if row[0]]


def get_receipt_stats(date_from: Optional[str] = None, date_to: Optional[str] = None) -> Dict:
    """レシート統計情報を取得"""
    client = _get_supabase_client()
    if client is not None:
        try:
            q = client.table("receipts").select("amount").eq("is_deleted", False)
            if date_from:
                q = q.gte("transaction_date", date_from)
            if date_to:
                q = q.lte("transaction_date", date_to)
            res = q.execute()
            rows = res.data or []
            return {
                "count": len(rows),
                "total": sum((r.get("amount") or 0) for r in rows),
            }
        except Exception as e:
            print(f"Supabase統計取得エラー: {e}")
            return {"count": 0, "total": 0.0}

    conn = _sqlite_conn()
    cursor = conn.cursor()
    query = 'SELECT COUNT(*) as count, SUM(amount) as total FROM receipts WHERE is_deleted = 0'
    params = []
    if date_from:
        query += ' AND transaction_date >= ?'
        params.append(date_from)
    if date_to:
        query += ' AND transaction_date <= ?'
        params.append(date_to)
    cursor.execute(query, params)
    row = cursor.fetchone()
    conn.close()
    return {
        'count': row['count'] or 0,
        'total': row['total'] or 0.0
    }
