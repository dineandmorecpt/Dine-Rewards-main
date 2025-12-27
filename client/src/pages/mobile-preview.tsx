import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Monitor } from "lucide-react";

export default function MobilePreview() {
  const [device, setDevice] = useState<"iphone" | "android">("iphone");
  const [route, setRoute] = useState("/diner/dashboard");

  const devices = {
    iphone: { width: 375, height: 812, name: "iPhone 14" },
    android: { width: 360, height: 800, name: "Android" },
  };

  const currentDevice = devices[device];

  const routes = [
    { path: "/diner/dashboard", label: "Dashboard" },
    { path: "/diner/vouchers", label: "Vouchers" },
    { path: "/diner/history", label: "History" },
    { path: "/diner/profile", label: "Profile" },
    { path: "/", label: "Home" },
    { path: "/login", label: "Login" },
    { path: "/register", label: "Register" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-6">Mobile Preview</h1>
        
        <div className="flex justify-center gap-4 mb-6">
          <Button
            variant={device === "iphone" ? "default" : "outline"}
            onClick={() => setDevice("iphone")}
            className="gap-2"
          >
            <Smartphone className="h-4 w-4" />
            iPhone
          </Button>
          <Button
            variant={device === "android" ? "default" : "outline"}
            onClick={() => setDevice("android")}
            className="gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Android
          </Button>
        </div>

        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {routes.map((r) => (
            <Button
              key={r.path}
              variant={route === r.path ? "default" : "outline"}
              size="sm"
              onClick={() => setRoute(r.path)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className="flex justify-center">
          <div 
            className="relative bg-black rounded-[3rem] p-3 shadow-2xl"
            style={{ width: currentDevice.width + 24, height: currentDevice.height + 24 }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-10" />
            
            <div 
              className="bg-white rounded-[2.5rem] overflow-hidden"
              style={{ width: currentDevice.width, height: currentDevice.height }}
            >
              <iframe
                src={route}
                className="w-full h-full border-0"
                title="Mobile Preview"
              />
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          {currentDevice.name} ({currentDevice.width} x {currentDevice.height})
        </p>
      </div>
    </div>
  );
}
