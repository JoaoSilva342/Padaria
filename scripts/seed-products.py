# Script to seed initial products in Firebase Firestore
# Run this once to populate your database with sample bakery products

from firebase_admin import credentials, firestore, initialize_app

# Initialize Firebase Admin SDK
# You'll need to download your Firebase service account key and place it in the project root
try:
    initialize_app()
except ValueError:
    pass

db = firestore.client()

products = [
    # Pães (Bread)
    {
        "name": "Pão Alentejano",
        "description": "Pão tradicional alentejano com casca estaladiça e miolo macio",
        "details": "Unidade. Ingredientes: farinha de trigo, água, fermento e sal.",
        "price": 2.50,
        "category": "bread",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Pão de Centeio",
        "description": "Pão rústico de centeio com sementes",
        "price": 3.20,
        "category": "bread",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Broa de Milho",
        "description": "Broa tradicional portuguesa feita com farinha de milho",
        "price": 2.80,
        "category": "bread",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Papo Seco",
        "description": "Pãozinho português clássico para o pequeno-almoço",
        "price": 0.40,
        "category": "bread",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    
    # Pastelaria (Pastries)
    {
        "name": "Pastel de Nata",
        "description": "O famoso pastel de nata português com canela",
        "details": "Unidade. Ingredientes: massa folhada, leite, ovos, açúcar, farinha e canela.",
        "price": 1.20,
        "category": "pastry",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Pastel de Tentúgal",
        "description": "Pastel tradicional recheado com doce de ovos",
        "price": 1.50,
        "category": "pastry",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Bola de Berlim",
        "description": "Bola fofa recheada com creme de ovos",
        "price": 1.30,
        "category": "pastry",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Croissant de Manteiga",
        "description": "Croissant artesanal folhado com manteiga",
        "price": 1.40,
        "category": "pastry",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Queijada de Sintra",
        "description": "Queijada tradicional de Sintra com queijo fresco",
        "price": 1.60,
        "category": "pastry",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    
    # Bolos (Cakes)
    {
        "name": "Bolo de Chocolate",
        "description": "Bolo húmido de chocolate com cobertura cremosa",
        "details": "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, chocolate em pó, manteiga e leite.",
        "price": 18.50,
        "category": "cake",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    
    # Snacks
    {
        "name": "Baguete Delícias do Mar",
        "description": "Baguete fresca recheada com pasta cremosa de delícias do mar",
        "details": "Unidade. Exemplo de ingredientes: baguete integral, delícias do mar desfiadas, cenoura ralada, ovo cozido, maionese, ketchup, pimenta preta e alface.",
        "price": 4.90,
        "category": "snacks",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Baguete Frango",
        "description": "Baguete crocante com frango desfiado e vegetais",
        "details": "Unidade. Ingredientes: baguete, frango desfiado, cenoura, milho, alface e molho leve.",
        "price": 4.70,
        "category": "snacks",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },

    # Bebidas
    {
        "name": "Sumo de Laranja Natural",
        "description": "Sumo natural espremido no momento",
        "details": "Copo 300ml. Ingredientes: laranja fresca, sem adição de açúcar.",
        "price": 2.40,
        "category": "drinks",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Limonada da Casa",
        "description": "Bebida refrescante de limão",
        "details": "Copo 300ml. Ingredientes: água, sumo de limão, açúcar e gelo.",
        "price": 2.10,
        "category": "drinks",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Bolo de Ananás",
        "description": "Bolo tropical com ananás caramelizado",
        "details": "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, ananás, manteiga e fermento.",
        "price": 16.00,
        "category": "cake",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Tarte de Maçã",
        "description": "Tarte de maçã caseira com canela",
        "details": "Bolo inteiro. Ingredientes: massa quebrada, maçã, açúcar, canela, manteiga e ovos.",
        "price": 15.50,
        "category": "cake",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
    {
        "name": "Bolo Rei",
        "description": "Bolo tradicional de Natal com frutas cristalizadas",
        "details": "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, manteiga, fermento e frutas cristalizadas.",
        "price": 22.00,
        "category": "cake",
        "image": "/placeholder.svg?height=400&width=400",
        "available": True
    },
]

# Add products to Firestore
products_ref = db.collection('products')

print("Adding products to Firestore...")
for product in products:
    doc_ref = products_ref.add(product)
    print(f"Added: {product['name']} (ID: {doc_ref[1].id})")

print("\nAll products added successfully!")
