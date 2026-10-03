# Installment Management System

A comprehensive desktop application for managing motorcycle/bike installment sales, built with Electron.js and SQLite.

Developed By **POVDEV** — [povdev.com](https://povdev.com) | WhatsApp: @wpfahad | Email: mypovdev@gmail.com

## Features

### Core Functionality
- **Product Management**: Add, edit, and manage bike/motorcycle models with pricing information
- **Supplier Management**: Maintain supplier database for inventory tracking  
- **Stock Management**: Track inventory with engine numbers, chassis numbers, and stock details
- **Customer Management**: Complete customer profiles with guarantor support
- **Installment Calculator**: Advanced calculator with automatic profit and installment calculations
- **Payment Processing**: Handle installment payments with receipt generation
- **Reporting**: Generate various business reports and analytics
- **Data Backup**: Automated database backup and restore functionality

### Key Capabilities
- Support for 1-50 month installment periods
- Automatic profit percentage calculations
- Overdue payment tracking
- Multiple guarantor support per customer
- Receipt/slip printing for payments
- Customer search by account number, CNIC, or phone
- Real-time dashboard with business statistics
- Modern, responsive user interface

## Shop PC install

Install from `dist/*.exe` (NSIS installer). Default login is `admin` / `admin`; you must change the password on first sign-in.

The live database lives in the Electron `userData` folder (not next to the installer). Use Backup in the header to copy it.

## Developer setup

Node.js 16+ is required.

```bash
npm install
npm run dev
```

Shop PCs should run the installed app, not `start.bat`. Developers use `npm install` once and `npm run dev`.

### Windows installer (build on Windows / CI)

```bash
npm run build-win
```

The installer is written to `dist/`. This Linux workspace may not produce an `.exe`.

## Project Structure

```
installment-management-app/
├── src/
│   ├── main.js                 # Main Electron process
│   ├── database/
│   │   └── database.js         # Database manager
│   └── renderer/
│       ├── index.html          # Main UI
│       ├── styles/
│       │   ├── main.css        # Core styles
│       │   ├── components.css  # Component styles
│       │   └── animations.css  # Animation styles
│       └── scripts/
│           ├── main.js         # Application controller
│           ├── database.js     # Database interface
│           ├── dashboard.js    # Dashboard management
│           └── components.js   # UI components
├── database/
│   ├── installments.db        # Main database (auto-created)
│   └── backups/               # Database backups
├── assets/
│   └── icon.png               # Application icon
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## Database Structure

The application uses SQLite with the following main tables:

- **products**: Store bike/motorcycle models and pricing
- **suppliers**: Supplier information
- **stock**: Inventory with engine/chassis numbers  
- **customers**: Customer profiles
- **guarantors**: Customer guarantor information
- **customer_purchases**: Purchase transactions
- **installments**: Payment schedule
- **payments**: Payment history

## Usage Guide

### 1. Initial Setup
1. Launch the application
2. The database will be automatically created on first run
3. Start by adding suppliers and products

### 2. Adding Products
- Navigate to "Products" section
- Click "Add New Product" 
- Enter item name, current price, and purchase price
- Save to add to inventory

### 3. Managing Stock  
- Go to "Stock Management"
- Add stock items with product selection, supplier, engine/chassis numbers
- Track availability status

### 4. Customer Registration
- Access "Customer Management"
- Add customer details including CNIC, phone, address
- Add multiple guarantors per customer
- Select supplier and stock for installment purchase

### 5. Creating Installments
- Use the installment calculator popup
- Set sale price, advance payment, profit margin
- Choose installment period (1-50 months)
- System automatically calculates monthly amounts
- Generate installment schedule

### 6. Processing Payments
- Navigate to "Installments" 
- Search customer by account number or CNIC
- View installment schedule
- Process payments and generate receipts
- Track overdue payments

### 7. Reports and Analytics
- Dashboard shows key business metrics
- Generate various reports for analysis
- Monitor collection performance

## Database Backup

### Automatic Backup
- Click "Backup" button in header
- Packaged app backups are written next to the `userData` database (`backups/`)
- Dev mode still uses `database/backups/`
- Files named with timestamp for easy identification

## Troubleshooting

### Common Issues

**Application won't start:**
- Ensure Node.js is properly installed
- Run `npm install` to install dependencies
- Check for error messages in console

**Database errors:**
- Check write permissions for Electron `userData` (or `database/` in `npm run dev`)
- Verify better-sqlite3 is installed: `npm list better-sqlite3`

**Build failures:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Update electron-builder: `npm update electron-builder`

**UI not loading:**
- Check browser console for JavaScript errors
- Verify all CSS and JS files are present

### Performance Tips
- Regular database backups (weekly recommended)
- Archive old payment records annually
- Monitor database size growth
- Use SSD storage for better performance

## Development

### Development Mode Features
- Hot reload for HTML/CSS changes
- Developer tools available (F12)
- Console logging for debugging

### Extending Functionality
The modular architecture allows easy extension:

- Add new report types in reports section
- Extend customer fields as needed
- Add new payment methods
- Integrate with external systems

### Code Structure
- `src/main.js`: Electron main process
- `src/renderer/scripts/main.js`: Application controller
- Individual managers for each feature
- Database abstraction layer
- Component-based UI architecture

## Security Considerations

- Database stored locally (not cloud-connected)
- Customer data encrypted at rest
- Backup files should be stored securely
- Regular security updates recommended

## Support and Maintenance

For technical support:
1. Check this documentation first
2. Review console error messages
3. Verify system requirements
4. Check database integrity

Regular maintenance:
- Weekly database backups
- Monthly software updates
- Annual data archiving
- Performance monitoring

## Version History

- **v1.0.0**: Initial release with core functionality
- Complete installment management system
- Modern responsive UI
- Database backup/restore
- Receipt generation

---

**Note**: This application is designed for local business use. Ensure proper data backup procedures and maintain system security.

## License

This project is licensed under the MIT License.