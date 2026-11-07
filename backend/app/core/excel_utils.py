import csv
import io
import re
from typing import Any, Dict, List, Optional
import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


def normalize_header(header: Optional[str]) -> str:
    """
    Normalizes a table column header string:
    - trims whitespace and converts to lower case
    - replaces spaces, dashes, dots, underscores with empty/standard form
    """
    if not header:
        return ""
    h = str(header).strip().lower()
    # Normalize common field name aliases
    alias_map = {
        "barcode": "code",
        "bar code": "code",
        "item code": "code",
        "product code": "code",
        "product_code": "code",
        "item_code": "code",
        "productcode": "code",
        "itemcode": "code",
        "product name": "name",
        "item name": "name",
        "product_name": "name",
        "item_name": "name",
        "productname": "name",
        "itemname": "name",
        "customer name": "name",
        "customer_name": "name",
        "customername": "name",
        "client name": "name",
        "clientname": "name",
        "price": "rate",
        "unit price": "rate",
        "unit rate": "rate",
        "unitprice": "rate",
        "unitrate": "rate",
        "wholesale rate": "rate",
        "wholesale price": "rate",
        "wholesalerate": "rate",
        "wholesaleprice": "rate",
        "cost": "rate",
        "item category": "category",
        "product category": "category",
        "itemcategory": "category",
        "productcategory": "category",
        "brand name": "brand",
        "brandname": "brand",
        "supplier": "vendor",
        "distributor": "vendor",
        "qty": "quantity",
        "stock": "quantity",
        "stock qty": "quantity",
        "stock quantity": "quantity",
        "stockqty": "quantity",
        "stockquantity": "quantity",
        "initial quantity": "quantity",
        "city": "place",
        "location": "place",
        "phone": "contact_number",
        "phone number": "contact_number",
        "phone_number": "contact_number",
        "phonenumber": "contact_number",
        "mobile": "contact_number",
        "contact": "contact_number",
        "contact no": "contact_number",
        "contact_no": "contact_number",
        "contactno": "contact_number",
        "contact number": "contact_number",
        "contact_number": "contact_number",
        "contactnumber": "contact_number",
        "mobile number": "contact_number",
        "mobile_number": "contact_number",
        "mobilenumber": "contact_number",
        "e-mail": "email",
        "email address": "email",
        "email_address": "email",
        "emailaddress": "email",
        "billing address": "address",
        "delivery address": "address",
        "billingaddress": "address",
        "deliveryaddress": "address",
    }
    if h in alias_map:
        return alias_map[h]
    # Remove special chars and check alias map again
    cleaned = re.sub(r"[^a-z0-9]", "", h)
    if cleaned in alias_map:
        return alias_map[cleaned]
    return cleaned


def parse_excel_or_csv_bytes(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Parses bytes of an Excel (.xlsx/.xls) or CSV (.csv) file into a list of row dicts.
    Keys are normalized column names.
    """
    lower_name = filename.lower()

    if lower_name.endswith(".csv"):
        # Handle CSV parsing with multiple encoding fallbacks
        decoded = None
        for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
            try:
                decoded = file_bytes.decode(encoding)
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if decoded is None:
            decoded = file_bytes.decode("utf-8", errors="replace")

        reader = csv.reader(io.StringIO(decoded))
        raw_rows = [row for row in reader if any(cell.strip() for cell in row)]
    else:
        # Default to Excel .xlsx using openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        raw_rows = list(sheet.iter_rows(values_only=True))

    if not raw_rows:
        return []

    # First non-empty row is header
    header_index = 0
    while header_index < len(raw_rows) and not any(raw_rows[header_index]):
        header_index += 1

    if header_index >= len(raw_rows):
        return []

    raw_headers = raw_rows[header_index]
    headers = [normalize_header(str(h) if h is not None else "") for h in raw_headers]

    rows: List[Dict[str, Any]] = []
    for row in raw_rows[header_index + 1 :]:
        if not any(cell is not None and str(cell).strip() != "" for cell in row):
            continue

        row_dict: Dict[str, Any] = {}
        for idx, col_name in enumerate(headers):
            if not col_name:
                continue
            val = row[idx] if idx < len(row) else None
            if val is not None:
                if isinstance(val, str):
                    val = val.strip()
            row_dict[col_name] = val

        if row_dict:
            rows.append(row_dict)

    return rows


def create_excel_template(
    sheet_title: str,
    headers: List[str],
    sample_rows: Optional[List[List[Any]]] = None,
) -> bytes:
    """
    Creates an aesthetically styled Excel template with bold headers,
    light indigo header fill, auto column widths, and sample rows.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title or "Template"

    # Header styling
    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center")

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment

    # Data rows
    data_font = Font(name="Calibri", size=10)
    data_alignment = Alignment(vertical="center")

    if sample_rows:
        for row_data in sample_rows:
            ws.append(row_data)

    # Style data rows and auto-fit column widths
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.font = data_font
            cell.alignment = data_alignment

    # Auto column width
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()
