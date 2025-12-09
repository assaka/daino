
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User, Auth } from "@/api/entities";
import {
  ShoppingBag,
  Store,
  Palette,
  Zap,
  Shield,
  Globe,
  Check,
  Star,
  ArrowRight,
  Play,
  Users,
  TrendingUp,
  Smartphone,
  CreditCard, // New icon for Checkout
  Calculator, // New icon for Tax
  Layout, User as UserIcon, ChevronDown, Settings, LogOut // New icon for CMS
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.jsx";
import { PageLoader } from "@/components/ui/page-loader";

export default function Landing() {
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

  const features = [
    {
      icon: Store,
      title: "Multi-Store Management",
      description: "Manage multiple stores from one dashboard with our Elite plan"
    },
    {
      icon: Palette,
      title: "Beautiful Themes",
      description: "Choose from professionally designed themes that convert"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Optimized for speed with modern technology stack"
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Bank-level security with 99.9% uptime guarantee"
    },
    {
      icon: Globe,
      title: "Global Ready",
      description: "Multi-currency, multi-language support out of the box"
    },
    {
      icon: Smartphone,
      title: "Mobile Optimized",
      description: "Perfect shopping experience on any device"
    },
    {
      icon: CreditCard,
      title: "Secure Checkout",
      description: "Secure and seamless checkout process with multiple payment options."
    },
    {
      icon: Calculator,
      title: "Automated Tax Calculation",
      description: "Automatically calculate sales tax for different regions and product types."
    },
    {
      icon: Layout,
      title: "Flexible CMS",
      description: "Easily manage your store's content with a powerful and intuitive CMS."
    }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      company: "Artisan Crafts",
      content: "Increased our sales by 300% in just 3 months. The platform is incredibly user-friendly.",
      rating: 5
    },
    {
      name: "Michael Chen",
      company: "Tech Gadgets Pro",
      content: "The multi-store feature is a game-changer. Managing 5 stores has never been easier.",
      rating: 5
    },
    {
      name: "Emma Rodriguez",
      company: "Fashion Forward",
      content: "Beautiful themes and powerful analytics. Everything we need in one platform.",
      rating: 5
    }
  ];

  if (isLoading) {
    return <PageLoader size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 material-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center material-elevation-1">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Commerce
              </span>
            </div>
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
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1">
                      Try Now
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-6 bg-blue-100 text-blue-700 px-4 py-1">
              🚀 New: Multi-Store Management Available
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Build Your Dream
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {" "}eCommerce Store
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Create stunning online stores with our powerful, modular platform. 
              From single stores to multi-store empires, we've got you covered.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to={createPageUrl("Onboarding")}>
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-2">
                  Try Now - Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="material-ripple">
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to help you create, manage, and grow your online business.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="material-elevation-1 hover:material-elevation-2 transition-all duration-300 border-0">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 material-elevation-1">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Loved by Thousands of Merchants
            </h2>
            <p className="text-xl text-gray-600">
              Join successful business owners who trust our platform
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="material-elevation-1 hover:material-elevation-2 transition-all duration-300 border-0">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4 italic">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">50K+</div>
              <div className="text-gray-600">Active Stores</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">$2B+</div>
              <div className="text-gray-600">Sales Processed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">99.9%</div>
              <div className="text-gray-600">Uptime</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">150+</div>
              <div className="text-gray-600">Countries</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your eCommerce Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of successful merchants. Start with 20 free credits today.
          </p>
          <Link to={createPageUrl("Onboarding")}>
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 material-ripple material-elevation-2">
              Try Now - No Credit Card Required
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Commerce</span>
              </div>
              <p className="text-gray-400">
                The modern eCommerce platform for ambitious merchants.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="#" className="hover:text-white">Features</Link></li>
                <li><Link to="#pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link to="#" className="hover:text-white">Templates</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="#" className="hover:text-white">Help Center</Link></li>
                <li><Link to="#" className="hover:text-white">Documentation</Link></li>
                <li><Link to="#" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="#" className="hover:text-white">About</Link></li>
                <li><Link to="#" className="hover:text-white">Blog</Link></li>
                <li><Link to="#" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Commerce. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
