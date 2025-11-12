# Smart Grocery Saver - Web Application

A responsive web application that helps you find the best grocery deals by comparing prices across stores. Originally built as a React Native mobile app, now converted to run in your browser with React and Vite.

## Features

- 📍 **Location-based Search**: Enter your postal code or use your current location
- 🔍 **Product Search**: Find grocery items and compare prices across multiple stores
- 🛒 **Shopping Cart**: Add items with quantity controls and manage your shopping list
- 📊 **Store Comparison**: See which store offers the best total for your cart
- ✅ **Shopping List**: Interactive checklist for in-store shopping
- 💰 **Savings History**: Track your savings over time
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for backend)
- MongoDB (for backend data storage)
- Backend server running on http://localhost:8000

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd smart-grocery-web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the project root:
```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Smart Grocery Saver
```

### 4. Start the Backend Server
In a separate terminal, navigate to the backend directory:
```bash
cd ../backend
python server.py
```

### 5. Start the Development Server
```bash
npm run dev
```

The application will be available at http://localhost:5173

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality checks

### Project Structure

```
smart-grocery-web/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/         # General purpose components
│   │   ├── screens/        # Main application screens
│   │   └── ui/             # Specific UI elements
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and external service integration
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions and constants
│   ├── contexts/           # React context providers
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── public/                 # Static assets
├── package.json            # Project dependencies and scripts
├── vite.config.ts          # Vite configuration
└── README.md               # This file
```

## API Integration

The web application connects to a FastAPI backend that provides the following endpoints:

- `POST /api/search` - Search for grocery items
- `POST /api/shopping-list` - Create/update shopping lists
- `GET /api/shopping-lists` - Get all shopping lists
- `POST /api/compare-stores` - Compare prices across stores
- `POST /api/savings` - Save completed shopping trips
- `GET /api/savings` - Get savings history

**Note**: Ensure the backend CORS configuration allows `http://localhost:5173`.

## Usage

1. **Set Your Location**: Enter your postal code manually or click "Use My Location"
2. **Search for Items**: Type grocery items (e.g., "milk", "bread", "eggs")
3. **Add to Cart**: Click "Add to Cart" on items you want to buy
4. **Compare Stores**: View your cart to see which store offers the best total
5. **Go Shopping**: Use the interactive shopping list when at the store
6. **Track Savings**: View your savings history to see how much you've saved

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **Routing**: React Router DOM
- **Styling**: CSS Modules with responsive design
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Backend**: FastAPI (Python), MongoDB
- **External API**: Flipp for grocery data

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and commit: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Troubleshooting

**Backend Connection Issues**
- Ensure the backend server is running on port 8000
- Check that CORS allows localhost:5173
- Verify the VITE_API_URL environment variable is correct

**Location Services Not Working**
- Ensure your browser supports geolocation
- Grant location permissions when prompted
- Some browsers require HTTPS for geolocation (use localhost for development)

**Build Errors**
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Ensure Node.js version is 18 or higher
- Check TypeScript configuration in tsconfig.json

## Development Notes

This web application is a conversion of the original React Native mobile app. Key differences include:

- **Location Services**: Uses browser Geolocation API instead of React Native Location
- **Storage**: Uses localStorage instead of AsyncStorage
- **Navigation**: React Router instead of React Navigation
- **Styling**: CSS Modules instead of StyleSheet
- **Icons**: Lucide React instead of Ionicons

The application maintains the same core functionality and user experience while being optimized for web browsers.
