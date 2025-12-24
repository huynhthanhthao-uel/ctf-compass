import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  Plus, 
  Settings, 
  LogOut,
  Menu,
  X,
  Github,
  Bell,
  User,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'New Analysis', url: '/jobs/new', icon: Plus },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (url: string) => location.pathname === url;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 mr-6 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold text-foreground leading-tight">
                CTF Compass
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Challenge Analyzer
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navItems.map((item) => (
              <Button
                key={item.title}
                variant={isActive(item.url) ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 font-medium transition-all",
                  isActive(item.url) 
                    ? "bg-secondary text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => navigate(item.url)}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Button>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* GitHub Link */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => window.open('https://github.com/huynhtrungcipp/ctf-compass', '_blank')}
            >
              <Github className="h-4 w-4" />
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive">
                2
              </Badge>
            </Button>

            {/* Settings Gear Icon */}
            <Button
              variant={isActive('/config') ? "secondary" : "ghost"}
              size="icon"
              className={cn(
                "h-8 w-8",
                isActive('/config') 
                  ? "text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => navigate('/config')}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="hidden lg:inline text-sm font-medium">Admin</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Administrator</p>
                    <p className="text-xs text-muted-foreground">admin@localhost</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/config')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.open('https://github.com/huynhtrungcipp/ctf-compass', '_blank')}
                >
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <nav className="container px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Button
                  key={item.title}
                  variant={isActive(item.url) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive(item.url) && "bg-secondary"
                  )}
                  onClick={() => {
                    navigate(item.url);
                    setMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Button>
              ))}
              <Button
                variant={isActive('/config') ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  isActive('/config') && "bg-secondary"
                )}
                onClick={() => {
                  navigate('/config');
                  setMobileMenuOpen(false);
                }}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 bg-muted/30">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 px-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            <span>CTF Compass v1.0.0</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/huynhtrungcipp/ctf-compass" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Github className="h-3 w-3" />
              GitHub
            </a>
            <span>•</span>
            <span>Security-First Analysis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
