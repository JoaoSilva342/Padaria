# Padaria Portuguesa - Sistema de Encomendas Online

Sistema completo de encomendas online para padaria portuguesa, desenvolvido com HTML, JavaScript vanilla, Firebase e CSS puro.

## Funcionalidades

### Para Clientes
- **Catálogo de Produtos**: Navegação por categorias (Pão, Pastelaria, Bolos)
- **Carrinho de Compras**: Sistema completo com ajuste de quantidades
- **Autenticação**: Login e registo com Firebase Authentication
- **Histórico de Encomendas**: Visualização de todas as encomendas realizadas
- **Encomenda sem Login**: Possibilidade de fazer encomendas como visitante

### Para Administradores
- **Dashboard Administrativo**: Visão geral das estatísticas
- **Gestão de Encomendas**: Atualização de estados em tempo real
- **Gestão de Produtos**: Criar novos produtos com URLs de imagens
- **Gestão de Utilizadores**: Criar contas de funcionários e administradores
- **Relatórios**: Total de encomendas, receita, pendentes e concluídas

### Para Funcionários
- **Gestão de Encomendas**: Atualização de estados das encomendas
- **Visualização de Produtos**: Acesso ao catálogo completo

### Sistema de Permissões
- **Administrador**: Acesso total (criar produtos, utilizadores, gerir encomendas)
- **Funcionário**: Pode gerir encomendas e produtos, mas não criar utilizadores
- **Cliente**: Pode fazer encomendas e ver histórico

## Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Autenticação**: Firebase Authentication
- **Base de Dados**: Cloud Firestore
- **Imagens**: URLs externas (sem custos de storage)
- **Tipografia**: Playfair Display (títulos) + Inter (corpo)

## Estrutura do Projeto

```
├── index.html                # Catálogo de produtos
├── cart.html                 # Carrinho de compras
├── auth.html                 # Login e registo
├── orders.html               # Histórico de encomendas
├── admin.html                # Painel administrativo
├── styles.css                # Estilos globais
├── firebase-config.js        # Configuração Firebase
├── main.js                   # Lógica da página principal
├── cart.js                   # Lógica do carrinho
├── auth.js                   # Lógica de autenticação
├── orders.js                 # Lógica de encomendas
├── admin.js                  # Lógica administrativa
└── setup-admin.js            # Script de configuração inicial
```

## Configuração

### Firebase já está configurado!

O projeto vem pré-configurado com as credenciais Firebase do projeto **padaria-f6399**.

**Não precisa de criar ficheiro `.env.local` - tudo está configurado!**

### O que precisa fazer no Firebase Console:

**Aceda a**: https://console.firebase.google.com/project/padaria-f6399

#### 1. Ativar Authentication
- Menu lateral → **Authentication** → **Get Started**
- Tab **"Sign-in method"** → **Email/Password** → Ativar

#### 2. Criar Firestore Database
- Menu lateral → **Firestore Database** → **Create database**
- Escolher modo **"production"** → Continuar
- Escolher localização **europe-west** → Ativar

#### 3. Configurar Regras de Segurança do Firestore
Em **Firestore Database** → **Rules**, copie e cole:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{product} {
      allow read: if true;
      allow write: if request.auth != null && 
                     (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    match /orders/{order} {
      allow read: if request.auth != null && 
                     (request.auth.uid == resource.data.userId || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'staff');
      allow create: if true;
      allow update: if request.auth != null && 
                       (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'staff');
    }
    
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && 
                      (request.auth.uid == userId || 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
  }
}
```

**NOTA**: Não precisa de ativar o Firebase Storage - o sistema usa URLs de imagens externas (sem custos).

## Instalação e Execução

Este é um projeto HTML puro, basta abrir os ficheiros num servidor web.

### Opção 1: Live Server (VS Code)
1. Instale a extensão "Live Server" no VS Code
2. Clique com botão direito em `index.html`
3. Selecione "Open with Live Server"

### Opção 2: Python HTTP Server
```bash
# Python 3
python -m http.server 8000

# Aceda a http://localhost:8000
```

### Opção 3: Node.js HTTP Server
```bash
# Instale o http-server globalmente
npm install -g http-server

# Execute na pasta do projeto
http-server -p 8000

# Aceda a http://localhost:8000
```

## Configuração Inicial

### 1. Criar Primeiro Administrador

1. Crie um administrador a partir do painel `admin.html` após configurar o Firebase.
2. Como alternativa, execute o fluxo de criação de utilizadores via Firebase Console.

### 2. Criar Produtos

Como administrador:
1. Faça login na aplicação
2. Aceda ao painel **Admin**
3. Na secção **"Gestão de Produtos"**:
   - Insira o nome do produto (ex: "Pão de Forma")
   - Defina o preço em euros (ex: 2.50)
   - Selecione a categoria (Pão, Pastelaria ou Bolos)
   - Cole o URL de uma imagem (pode usar Google Drive, Imgur, etc)
4. Clique em **"Criar Produto"**

**Dica**: Para hospedar imagens gratuitamente, use:
- Imgur (https://imgur.com)
- Google Drive (partilhar → obter link)
- Unsplash (https://unsplash.com)

### 3. Criar Utilizadores (Admin/Funcionários)

Como administrador:
1. No painel Admin, aceda à secção **"Gestão de Utilizadores"**
2. Preencha:
   - Email
   - Password (mínimo 6 caracteres)
   - Nome completo
   - Tipo de conta (Funcionário ou Administrador)
3. Clique em **"Criar Utilizador"**

## Esquema de Cores

O projeto usa um esquema de cores quente inspirado em padarias tradicionais:

- **Primary**: Castanho terra (#8B6847)
- **Background**: Bege suave (#FAF8F5)
- **Accent**: Laranja queimado (#B8754E)
- **Neutral**: Tons de cinza e branco

## Estrutura de Dados

### Coleção `users`
```javascript
{
  email: string,
  name: string,
  phone: string,
  role: 'admin' | 'staff' | 'customer',
  createdAt: timestamp
}
```

### Coleção `products`
```javascript
{
  name: string,
  price: number,
  category: 'bread' | 'pastry' | 'cake',
  image: string (URL externa),
  createdAt: timestamp
}
```

### Coleção `orders`
```javascript
{
  userId: string (opcional),
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  items: [{
    id: string,
    name: string,
    price: number,
    quantity: number
  }],
  total: number,
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled',
  createdAt: timestamp
}
```

## Fluxo de Trabalho

1. **Cliente** navega pelos produtos e adiciona ao carrinho
2. **Cliente** finaliza encomenda (com ou sem login)
3. **Funcionário/Admin** vê a encomenda no painel admin
4. **Funcionário/Admin** atualiza o estado: Pendente → A preparar → Pronto → Concluída
5. **Cliente** pode ver o histórico de encomendas (se tiver conta)

## Segurança

- Autenticação obrigatória para áreas administrativas
- Verificação de permissões no frontend e backend
- Regras de segurança do Firestore protegem dados sensíveis
- Passwords com mínimo 6 caracteres
- Campo de telefone obrigatório no registo

## Custos

**Este projeto é 100% GRATUITO**:
- Firebase Authentication: Gratuito até 50,000 utilizadores/mês
- Cloud Firestore: Gratuito até 50,000 leituras/dia
- Hosting de imagens: Usa URLs externas (sem custos Firebase Storage)

## Próximos Passos

- [x] Sistema de permissões (Admin/Funcionário/Cliente)
- [x] Gestão de produtos com URLs de imagens
- [x] Criação de utilizadores pelo admin
- [x] Campo de telefone obrigatório
- [ ] Integração com sistema de pagamentos (Stripe/MBWay)
- [ ] Sistema de notificações por email
- [ ] Sistema de avaliações de produtos
- [ ] Programa de fidelização
- [ ] Integração com sistema de entregas
- [ ] Modo escuro
- [ ] Relatórios avançados (gráficos de vendas)

## Licença

Projeto desenvolvido para fins académicos - Trabalho Prático.
