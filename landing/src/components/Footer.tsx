import { Heart } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 border-t border-border/50 bg-cream">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © {currentYear} Мария. Все права защищены.
          </p>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            Сделано с <Heart className="w-4 h-4 text-primary fill-primary" /> в России
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
