import React, { useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FlashMessage({ message, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Auto-hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle
  };

  const colors = {
    success: "bg-green-100 border-green-500 text-green-800",
    error: "bg-red-100 border-red-500 text-red-800",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-800"
  };

  const Icon = icons[message.type] || AlertCircle;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className={`${colors[message.type]} border-l-4 p-4 rounded-lg shadow-lg animate-in slide-in-from-top duration-300`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-2" />
            <p className="text-sm font-medium">{message.message || message.text}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-auto hover:bg-transparent"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}