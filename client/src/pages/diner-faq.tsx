import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How do I earn points?",
    answer: "You earn points every time you dine at a participating restaurant. Simply show your Member QR code (found in the sidebar) to the cashier when paying, and they'll scan it to add points to your account. You earn 1 point for every R1 spent."
  },
  {
    question: "How many points do I need for a voucher?",
    answer: "You need 1000 points to earn a voucher. Once you reach 1000 points, you'll receive a voucher to claim in your 'My Vouchers' tab. Your points will reset to 0 and you can start earning towards your next voucher."
  },
  {
    question: "How do I redeem my voucher?",
    answer: "Go to the 'My Vouchers' tab in your dashboard, tap on an active voucher, and show the QR code to the cashier at the restaurant. They'll scan it to apply your discount."
  },
  {
    question: "Do my points expire?",
    answer: "No, your points never expire! They stay in your account until you earn enough for a voucher. However, vouchers do have an expiry date, so make sure to use them before they expire."
  },
  {
    question: "Can I use vouchers at any branch?",
    answer: "This depends on the restaurant's settings. Most restaurants allow vouchers to be redeemed at any of their branches. Check with the specific restaurant if you're unsure."
  },
  {
    question: "How do I check my points balance?",
    answer: "Your points balance is shown on your dashboard under 'My Points'. You can see your current points and how close you are to earning your next voucher."
  },
  {
    question: "Can I earn points at multiple restaurants?",
    answer: "Yes! You can earn and track points at multiple participating restaurants. Each restaurant has its own points balance, which you can view by selecting different restaurants in your dashboard."
  },
  {
    question: "What if the cashier can't scan my QR code?",
    answer: "If there's an issue scanning, the cashier can manually enter your phone number to find your account and add your points. Make sure your profile has your correct phone number."
  },
  {
    question: "How do I update my profile information?",
    answer: "Go to 'Profile' in the menu to update your name, email, or phone number. Note that changing your phone number requires verification via SMS."
  },
  {
    question: "Who do I contact if I have a problem?",
    answer: "If you have any issues with your points or vouchers, please speak to the restaurant staff during your visit. They can help resolve most issues immediately."
  }
];

export default function DinerFaq() {
  return (
    <DinerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            FAQ
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Frequently asked questions about your rewards
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Common Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} data-testid={`faq-item-${index}`}>
                  <AccordionTrigger className="text-left text-sm sm:text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </DinerLayout>
  );
}
