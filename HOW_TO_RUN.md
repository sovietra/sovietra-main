# Vista Kartrace 2024 — Hoe te starten

## Project structuur

```
sovietra-main/
├── vista-karting/          ← Originele PHP website
├── vista-karting-react/    ← Nieuwe React frontend
└── vista-karting-api/      ← Nieuwe C# backend (ASP.NET Core)
```

---

## React + C# versie starten

Je hebt twee terminals nodig — één voor de backend, één voor de frontend.

### Terminal 1 — C# API starten

```bash
cd vista-karting-api
dotnet run
```

De API draait op: http://localhost:5000

### Terminal 2 — React app starten

```bash
cd vista-karting-react
npm run dev
```

De website draait op: http://localhost:5173

---

## API Endpoints

| Method | URL                      | Wat doet het               |
|--------|--------------------------|----------------------------|
| POST   | /api/registration        | Student inschrijven        |
| GET    | /api/registration        | Alle inschrijvingen zien   |
| GET    | /api/poules?dag=1        | Poules ophalen (dag 1/2/3) |
| POST   | /api/contact             | Contactbericht versturen   |

De SQLite database (`vista_karting.db`) wordt automatisch aangemaakt bij het eerste opstarten.

---

## Originele PHP versie starten

```bash
cd vista-karting
php -S localhost:8000
```

Open: http://localhost:8000/index.php

Vereist een MySQL database. Pas `connection.inc.php` aan met je gegevens:
- Host: localhost
- Database: vista_karting
- Gebruiker: root
- Wachtwoord: (jouw wachtwoord)

Database tabel aanmaken:
```sql
CREATE DATABASE vista_karting;
USE vista_karting;
CREATE TABLE tb_studenten (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nummer VARCHAR(20) NOT NULL,
    voornaam VARCHAR(100) NOT NULL,
    tussenvoegsel VARCHAR(20),
    achternaam VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL
);
```
