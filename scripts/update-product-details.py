# Script to update product details in Firestore by product name keywords.
# Useful to enrich existing products without editing one-by-one in admin UI.

import os
import sys

from firebase_admin import credentials, firestore, initialize_app

try:
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if service_account_path:
        cred = credentials.Certificate(service_account_path)
        initialize_app(cred)
    else:
        initialize_app()
except ValueError:
    pass


try:
    db = firestore.client()
except Exception as exc:
    print("Erro: credenciais Firebase não encontradas.")
    print(
        "Define FIREBASE_SERVICE_ACCOUNT com o caminho para o JSON da service account, "
        "por exemplo:"
    )
    print(
        "PowerShell: $env:FIREBASE_SERVICE_ACCOUNT='C:/caminho/para/serviceAccountKey.json'"
    )
    print(f"Detalhe técnico: {exc}")
    sys.exit(1)

# Keep text concise and practical for product cards.
DETAILS_BY_KEYWORD = {
    "baguete delicias do mar": (
        "Unidade. Exemplo de ingredientes: baguete integral, delicias do mar desfiadas, "
        "cenoura ralada, ovo cozido, maionese, ketchup, pimenta preta e alface."
    ),
    "baguete de delicias do mar": (
        "Unidade. Exemplo de ingredientes: baguete integral, delicias do mar desfiadas, "
        "cenoura ralada, ovo cozido, maionese, ketchup, pimenta preta e alface."
    ),
    "sumo de laranja": "Copo 300ml. Ingredientes: laranja fresca, sem adicao de acucar.",
    "limonada": "Copo 300ml. Ingredientes: agua, sumo de limao, acucar e gelo.",
}


def normalize(text):
    return " ".join(str(text or "").strip().lower().split())


def find_details(product_name):
    name = normalize(product_name)
    for keyword, details in DETAILS_BY_KEYWORD.items():
        if keyword in name:
            return details
    return None


products_ref = db.collection("products")
docs = products_ref.stream()
updated = 0

for doc in docs:
    data = doc.to_dict() or {}
    name = data.get("name", "")
    details = find_details(name)
    if not details:
        continue

    # Keep compatibility with existing UI fallback (details -> description)
    doc.reference.update({
        "details": details,
        "description": details,
    })
    updated += 1
    print(f"Updated: {name}")

print(f"Done. Updated {updated} product(s).")
