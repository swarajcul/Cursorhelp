# Raptor Esports CRM - Modular Web Application

A modern, modular web application built with Next.js 14, TypeScript, and Tailwind CSS for managing esports teams and tournaments. This application follows a LEGO-style architecture where different modules can be added and removed independently.

## 🏗️ Architecture

This application is designed with a modular architecture that allows for easy extension and maintenance:

### Core Technologies
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Radix UI** - Accessible component library
- **Tesseract.js** - OCR functionality for performance data extraction

### Module Structure

```
├── app/                           # Next.js App Router
│   ├── auth/                     # Authentication Module
│   │   ├── login/               # Login page
│   │   └── signup/              # Signup page
│   ├── dashboard/               # Dashboard Module
│   │   ├── page.tsx            # Main dashboard
│   │   ├── performance/        # Performance Analytics
│   │   ├── profile/            # Profile Management
│   │   ├── user-management/    # User Management
│   │   └── team-management/    # Team Management Module
│   │       ├── teams/          # Team CRUD operations
│   │       ├── roster/         # Player roster management
│   │       ├── expenses/       # Expense tracking
│   │       ├── prize-pool/     # Prize pool management
│   │       └── slots/          # Tournament slots
│   └── globals.css             # Global styles
├── components/                  # Reusable Components
│   ├── ui/                     # UI Component Library
│   ├── performance/            # Performance-specific components
│   ├── app-sidebar.tsx         # Application sidebar
│   └── theme-provider.tsx      # Theme management
├── hooks/                      # Custom React Hooks
├── lib/                        # Core Libraries
│   ├── supabase.ts            # Database client and types
│   ├── ocr-service.ts         # OCR functionality
│   ├── advanced-ocr-service.ts # Advanced OCR processing
│   └── utils.ts               # Utility functions
└── utils/                      # Additional utilities
```

## 🚀 Features

### ✅ Implemented Modules
- **Authentication System** - Login/Signup with Supabase Auth
- **Dashboard** - Comprehensive overview with role-based access
- **Team Management** - Complete CRUD operations for teams
- **User Management** - User profiles and role management
- **Roster Management** - Player assignments and team rosters
- **Expense Tracking** - Financial management with filtering
- **Prize Pool Management** - Tournament prize distribution
- **Performance Analytics** - OCR-based performance data extraction
- **Responsive Design** - Mobile-first responsive layout

### 🛠️ Technical Features
- **Type Safety** - Full TypeScript coverage
- **Role-Based Access Control** - Admin, Manager, Coach, Player, Analyst roles
- **OCR Integration** - Automatic performance data extraction from screenshots
- **Real-time Updates** - Live data synchronization
- **Modular Architecture** - Easy to extend with new modules
- **Comprehensive UI Library** - 50+ pre-built components
- **Theme Support** - Dark/Light mode toggle

## 📱 Application Structure

### User Roles & Permissions
- **Admin** - Full system access
- **Manager** - Team and user management
- **Coach** - Team-specific management
- **Player** - Limited access to own team data
- **Analyst** - Performance data access

### Database Schema
The application uses a well-structured PostgreSQL database with the following main tables:
- `users` - User profiles and authentication
- `teams` - Team information and hierarchy
- `rosters` - Player-team assignments
- `performances` - Individual player performance data
- `slots` - Tournament slots and scheduling
- `slot_expenses` - Financial tracking
- `prize_pools` - Prize distribution
- `winnings` - Tournament results

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account (or use provided demo credentials)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd raptor-esports-crm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   - Create tables using the schema in `lib/supabase.ts`
   - Set up Row Level Security (RLS) policies
   - Configure authentication settings

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript check

### Code Quality
- **ESLint** - Configured with Next.js and TypeScript rules
- **TypeScript** - Strict type checking enabled
- **Prettier** - Code formatting (recommended)
- **Tailwind CSS** - Utility-first styling

### Adding New Modules

1. **Create module directory** under `app/dashboard/`
2. **Add page components** with proper TypeScript types
3. **Update navigation** in `components/app-sidebar.tsx`
4. **Add database tables** if needed in `lib/supabase.ts`
5. **Create reusable components** in `components/`
6. **Add proper role-based access control**

## 📊 Performance

The application is optimized for performance with:
- **Static Generation** - Pre-built pages where possible
- **Code Splitting** - Automatic chunk splitting
- **Image Optimization** - Next.js Image component
- **Bundle Analysis** - Optimized bundle sizes

## 🔒 Security

Security measures implemented:
- **Row Level Security** - Database-level access control
- **Type Safety** - Prevents common runtime errors
- **Input Validation** - Zod schema validation
- **Authentication** - Supabase Auth with JWT tokens
- **CSRF Protection** - Built-in Next.js protection

## 🚨 Known Limitations

1. **OCR Service** - Words extraction API not available in current Tesseract.js version
2. **Real-time Updates** - Some features may require manual refresh
3. **File Upload** - Limited file size for OCR processing
4. **Browser Compatibility** - Modern browsers only

## 🛣️ Roadmap

- [ ] Real-time notifications system
- [ ] Advanced analytics dashboard
- [ ] Mobile app integration
- [ ] Tournament bracket management
- [ ] Advanced reporting features
- [ ] API documentation
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support or questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review the code comments for implementation details

---

**Note**: This application is designed for esports team management and includes features specific to competitive gaming scenarios. The modular architecture allows for easy customization to other use cases.