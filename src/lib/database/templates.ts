export interface DatabaseTemplate {
  name: string;
  description: string;
  sql: string;
}

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
  {
    name: "E-Commerce System",
    description: "Contains products, customers, orders, order details, and payment histories.",
    sql: `
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL,
        category TEXT NOT NULL
      );

      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        status TEXT NOT NULL,
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );

      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price_at_purchase REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      INSERT INTO customers (name, email, phone, address) VALUES 
        ('Alice Smith', 'alice@example.com', '123-456-7890', '123 Maple St'),
        ('Bob Jones', 'bob@example.com', '987-654-3210', '456 Oak Ave'),
        ('Charlie Brown', 'charlie@example.com', '555-555-5555', '789 Pine Rd');

      INSERT INTO products (title, price, stock, category) VALUES 
        ('Wireless Mouse', 29.99, 150, 'Electronics'),
        ('Mechanical Keyboard', 89.99, 50, 'Electronics'),
        ('USB-C Hub', 19.99, 200, 'Electronics'),
        ('Desk Lamp', 34.99, 80, 'Office Supplies'),
        ('Ergonomic Chair', 199.99, 15, 'Furniture');

      INSERT INTO orders (customer_id, status) VALUES 
        (1, 'Completed'),
        (2, 'Processing'),
        (1, 'Shipped');

      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES 
        (1, 1, 1, 29.99),
        (1, 3, 2, 19.99),
        (2, 2, 1, 89.99),
        (3, 5, 1, 199.99);
    `
  },
  {
    name: "Hospital Management",
    description: "Manages patients, doctors, appointments, medical records, and billing receipts.",
    sql: `
      CREATE TABLE doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      CREATE TABLE patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        dob DATE NOT NULL,
        phone TEXT,
        blood_group TEXT
      );

      CREATE TABLE appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER,
        patient_id INTEGER,
        appointment_date DATETIME NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id),
        FOREIGN KEY (patient_id) REFERENCES patients(id)
      );

      CREATE TABLE medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        diagnosis TEXT NOT NULL,
        treatment TEXT NOT NULL,
        prescription TEXT,
        record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id)
      );

      INSERT INTO doctors (name, specialization, email) VALUES 
        ('Dr. Robert Chen', 'Cardiology', 'robert.chen@hospital.com'),
        ('Dr. Sarah Patel', 'Pediatrics', 'sarah.patel@hospital.com'),
        ('Dr. Emily Stone', 'General Medicine', 'emily.stone@hospital.com');

      INSERT INTO patients (name, dob, phone, blood_group) VALUES 
        ('John Doe', '1985-05-15', '555-0199', 'O+'),
        ('Jane Watson', '1992-09-23', '555-0144', 'A-'),
        ('Arthur Pendragon', '1960-12-01', '555-0122', 'AB+');

      INSERT INTO appointments (doctor_id, patient_id, appointment_date, status) VALUES 
        (1, 1, '2026-07-10 09:00:00', 'Scheduled'),
        (2, 2, '2026-07-11 14:30:00', 'Completed'),
        (3, 3, '2026-07-12 11:15:00', 'Scheduled');

      INSERT INTO medical_records (patient_id, diagnosis, treatment, prescription) VALUES 
        (1, 'Hypertension', 'Diet adjustment and medication', 'Lisinopril 10mg once daily'),
        (2, 'Common Cold', 'Rest and hydration', 'Cough syrup as needed'),
        (3, 'Vitamin D Deficiency', 'Supplements recommendation', 'Vitamin D3 50000 IU weekly');
    `
  },
  {
    name: "Netflix Clone",
    description: "Includes users, subscription profiles, movies/shows, watch histories, and genres.",
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        plan TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        avatar_url TEXT,
        is_kids BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        release_year INTEGER,
        type TEXT NOT NULL, -- 'movie' or 'show'
        duration TEXT
      );

      CREATE TABLE watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER,
        content_id INTEGER,
        progress_seconds INTEGER DEFAULT 0,
        last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id),
        FOREIGN KEY (content_id) REFERENCES content(id)
      );

      INSERT INTO users (email, password, plan) VALUES 
        ('user1@example.com', 'hashed_pass_1', 'Premium'),
        ('user2@example.com', 'hashed_pass_2', 'Standard');

      INSERT INTO profiles (user_id, name, avatar_url, is_kids) VALUES 
        (1, 'Dad', 'avatar_1.png', 0),
        (1, 'Kids Profile', 'avatar_kids.png', 1),
        (2, 'Main Profile', 'avatar_2.png', 0);

      INSERT INTO content (title, description, release_year, type, duration) VALUES 
        ('Stranger Things', 'Mysterious adventures in Hawkins', 2016, 'show', '4 Seasons'),
        ('Extraction', 'Action thriller starring Chris Hemsworth', 2020, 'movie', '120 min'),
        ('The Crown', 'Historical drama about Queen Elizabeth II', 2016, 'show', '6 Seasons'),
        ('Finding Nemo', 'Animated underwater search for a lost fish', 2003, 'movie', '100 min');

      INSERT INTO watch_history (profile_id, content_id, progress_seconds) VALUES 
        (1, 1, 3600),
        (1, 2, 7200),
        (2, 4, 6000),
        (3, 3, 1800);
    `
  },
  {
    name: "Banking System",
    description: "Tracks bank customers, deposit accounts, funds transfers, and bank statements.",
    sql: `
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        ssn TEXT UNIQUE NOT NULL,
        email TEXT
      );

      CREATE TABLE accounts (
        id TEXT PRIMARY KEY, -- Account Number
        client_id INTEGER,
        type TEXT NOT NULL, -- 'Checking', 'Savings'
        balance REAL DEFAULT 0.0,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT,
        type TEXT NOT NULL, -- 'Deposit', 'Withdrawal', 'Transfer'
        amount REAL NOT NULL,
        description TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      INSERT INTO clients (first_name, last_name, ssn, email) VALUES 
        ('Bruce', 'Wayne', '111-222-3333', 'bruce@waynecorp.com'),
        ('Clark', 'Kent', '444-555-6666', 'clark.kent@dailyplanet.com'),
        ('Diana', 'Prince', '777-888-9999', 'diana@themiscira.org');

      INSERT INTO accounts (id, client_id, type, balance, status) VALUES 
        ('ACCT-0001', 1, 'Checking', 10000000.0, 'Active'),
        ('ACCT-0002', 1, 'Savings', 50000000.0, 'Active'),
        ('ACCT-0003', 2, 'Checking', 2500.50, 'Active'),
        ('ACCT-0004', 3, 'Savings', 75000.00, 'Active');

      INSERT INTO transactions (account_id, type, amount, description) VALUES 
        ('ACCT-0001', 'Deposit', 50000.0, 'Deposit from Wayne Enterprises'),
        ('ACCT-0003', 'Withdrawal', 100.0, 'ATM cash withdrawal'),
        ('ACCT-0004', 'Deposit', 1500.0, 'Monthly interest payout');
    `
  },
  {
    name: "Social Media Platform",
    description: "Maintains user accounts, status posts, comments/replies, and follower relations.",
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        bio TEXT,
        joined_date DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        content TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_id INTEGER,
        comment_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE follows (
        follower_id INTEGER,
        following_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, following_id),
        FOREIGN KEY (follower_id) REFERENCES users(id),
        FOREIGN KEY (following_id) REFERENCES users(id)
      );

      INSERT INTO users (username, bio) VALUES 
        ('coder123', 'Passionate full-stack developer'),
        ('database_pro', 'DB administrator & schema designer'),
        ('tech_geek', 'Sharing the latest tech news');

      INSERT INTO posts (user_id, content, likes_count) VALUES 
        (1, 'Just migrated my database to SQLite WebAssembly! Loving it!', 42),
        (2, 'Tip of the day: Always index foreign keys in large databases.', 128),
        (3, 'Apple announces new specs for the upcoming processors.', 15);

      INSERT INTO comments (post_id, user_id, comment_text) VALUES 
        (1, 2, 'Off-thread workers make a huge speed difference!'),
        (1, 3, 'Nice work!'),
        (2, 1, 'Absolutely true, saves significant index scan time.');

      INSERT INTO follows (follower_id, following_id) VALUES 
        (1, 2),
        (2, 1),
        (3, 1),
        (3, 2);
    `
  },
  {
    name: "Inventory System",
    description: "Tracks warehouse locations, stock items, suppliers, and purchase transactions.",
    sql: `
      CREATE TABLE warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL
      );

      CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT
      );

      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        supplier_id INTEGER,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );

      CREATE TABLE stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warehouse_id INTEGER,
        item_id INTEGER,
        quantity INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (item_id) REFERENCES items(id)
      );

      INSERT INTO warehouses (name, location) VALUES 
        ('Central Warehouse A', 'Chicago, IL'),
        ('Coastal Hub B', 'Seattle, WA');

      INSERT INTO suppliers (name, contact_person, phone) VALUES 
        ('Global Logistics Parts', 'Steve Miller', '555-4022'),
        ('Office Tech Wholesale', 'Karen Page', '555-9011');

      INSERT INTO items (sku, name, supplier_id) VALUES 
        ('SKU-10022', 'Industrial Steel Bolts', 1),
        ('SKU-20044', 'Ergonomic Desk Pads', 2),
        ('SKU-30088', 'Heavy Duty Crate Wraps', 1);

      INSERT INTO stock (warehouse_id, item_id, quantity) VALUES 
        (1, 1, 5000),
        (1, 2, 350),
        (2, 1, 1200),
        (2, 3, 80);
    `
  }
];
