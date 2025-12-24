import React, {useEffect, useState} from 'react';
import { Button } from "@/components/ui/button";
import {ChevronDown, LogOut, Settings, Sparkles, User as UserIcon} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.jsx";
import {createPageUrl} from "@/utils/index.js";
import {Auth, User} from "@/api/entities.js";
import {Link} from "react-router-dom";

export default function Header() {

    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const userData = await User.me();

            // Only show admin users as logged in on admin pages like Landing
            // Customers should not appear as logged in on admin areas
            if (userData && (userData.role === 'store_owner' || userData.role === 'admin' || userData.account_type === 'agency')) {
                setUser(userData);
            } else {
                // Customers should not appear as logged in on admin landing page
                setUser(null);
            }
        } catch (error) {
            // User not authenticated - this is fine for landing page
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
            <div className="max-w-7xl mx-auto p-2 md:px-6 md:py-4">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        {/*<img src="/logo_brown.svg" alt="DainoStore" className="h-12" />*/}
                        <img src="/logo_red.svg" alt="DainoStore" className="h-12" />
                        {/*<img src="/logo_blue.svg" alt="DainoStore" className="h-12" />*/}
                        {/*<img src="/logo_darkgreen.svg" alt="DainoStore" className="h-12" />*/}
                        {/*<img src="/logo_darkgreen_red.svg" alt="DainoStore" className="h-12" />*/}
                        {/*<img src="/logo_green.svg" alt="DainoStore" className="h-12" />*/}
                        {/*<img src="/logo_orange.svg" alt="DainoStore" className="h-12" />*/}
                        <span className="text-xl font-bold">DainoStore</span>
                    </div>

                    {/* Navigation - Centered (Desktop) */}
                    <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 font-semibold text-lg">
                        <a href="https://discord.gg/J3BCegpX" className="text-slate-600 hover:text-indigo-600 transition-colors">
                            Discord
                        </a>
                        <a href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors">
                            Pricing
                        </a>
                        <a href="#resources" className="text-slate-600 hover:text-indigo-600 transition-colors">
                            Resources
                        </a>
                    </nav>

                    {/* Auth Buttons */}
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-1"
                                    >
                                        <UserIcon className="w-4 h-4" />
                                        <span>{user.first_name || user.name || user.email}</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56">
                                    <DropdownMenuLabel>{user.first_name || user.name || user.email}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => {
                                        if (user.account_type === 'agency' || user.role === 'admin' || user.role === 'store_owner') {
                                            window.location.href = createPageUrl('Dashboard');
                                        } else {
                                            window.location.href = createPageUrl('CustomerDashboard');
                                        }
                                    }}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Dashboard</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        Auth.logout();
                                        window.location.href = createPageUrl('Auth');
                                    }}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Logout</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <>
                                <Link to="/auth">
                                    <Button variant="ghost" className="material-ripple">
                                        Sign In
                                    </Button>
                                </Link>
                                <Link to={createPageUrl("Onboarding")}>
                                    <Button className="bg-green-500 text-white">
                                        Try Now
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile Navigation - Below logo row */}
                <nav className="flex md:hidden items-center justify-center gap-6 font-semibold text-base mt-2">
                    <a href="https://discord.gg/J3BCegpX" className="text-slate-600 hover:text-indigo-600 transition-colors">
                        Discord
                    </a>
                    <a href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors">
                        Pricing
                    </a>
                    <a href="#resources" className="text-slate-600 hover:text-indigo-600 transition-colors">
                        Resources
                    </a>
                </nav>
            </div>
        </header>
    );
}