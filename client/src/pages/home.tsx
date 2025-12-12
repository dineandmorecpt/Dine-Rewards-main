import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Utensils, ChefHat, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute bottom-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-secondary/30 blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-6xl md:text-8xl font-serif font-bold tracking-tight text-primary">
            Dine<span className="text-chart-1">&</span>More
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-2xl mx-auto">
            The premium rewards experience for exceptional dining.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          {/* Diner Card */}
          <Link href="/diner/dashboard">
            <div className="group relative overflow-hidden rounded-xl border bg-card p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full text-left">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Utensils className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Utensils className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-serif font-bold">For Diners</h2>
                <p className="text-muted-foreground">
                  Discover exclusive rewards, book tables, and manage your dining profile.
                </p>
                <div className="pt-4 flex items-center text-primary font-medium group-hover:translate-x-1 transition-transform">
                  Enter as Diner <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>

          {/* Restaurant Admin Card */}
          <Link href="/admin/dashboard">
            <div className="group relative overflow-hidden rounded-xl border bg-card p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full text-left">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ChefHat className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ChefHat className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-serif font-bold">For Restaurants</h2>
                <p className="text-muted-foreground">
                  Manage rewards, view analytics, and grow your customer loyalty.
                </p>
                <div className="pt-4 flex items-center text-primary font-medium group-hover:translate-x-1 transition-transform">
                  Enter Admin Portal <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 text-sm text-muted-foreground/60">
        © 2024 Dine&More. Elevating the dining experience.
      </footer>
    </div>
  );
}
