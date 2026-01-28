import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

interface Diner {
  id: string;
  name: string;
  avatar: string;
  lastVisit: string;
  totalSpent: string;
  status: "VIP" | "Regular" | "New";
}

export function RecentActivity() {
  const diners: Diner[] = [
    { id: "1", name: "Olivia Martin", avatar: "OM", lastVisit: "2 hours ago", totalSpent: "$1,250.00", status: "VIP" },
    { id: "2", name: "Jackson Lee", avatar: "JL", lastVisit: "Yesterday", totalSpent: "$450.00", status: "Regular" },
    { id: "3", name: "Isabella Nguyen", avatar: "IN", lastVisit: "Yesterday", totalSpent: "$120.00", status: "New" },
    { id: "4", name: "William Kim", avatar: "WK", lastVisit: "2 days ago", totalSpent: "$890.00", status: "VIP" },
    { id: "5", name: "Sofia Davis", avatar: "SD", lastVisit: "3 days ago", totalSpent: "$350.00", status: "Regular" },
  ];

  const getBadgeVariant = (status: string) => {
    switch(status) {
      case "VIP": return "default"; // Primary/Gold
      case "Regular": return "secondary";
      case "New": return "outline";
      default: return "secondary";
    }
  };

  return (
    <Card className="col-span-1 shadow-sm border-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="font-serif text-xl">Recent Diners</CardTitle>
          <CardDescription>
            Latest visits from your rewards members
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          View All <ArrowUpRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Last Visit</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diners.map((diner) => (
              <TableRow key={diner.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {diner.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-sans font-medium">{diner.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(diner.status) as any} className="font-normal rounded-full px-3">
                    {diner.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{diner.lastVisit}</TableCell>
                <TableCell className="text-right font-medium">{diner.totalSpent}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
