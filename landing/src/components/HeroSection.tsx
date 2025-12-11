import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center gradient-hero overflow-hidden pt-20">
      {/* Decorative blur blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blush rounded-full blur-blob" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-soft-peach rounded-full blur-blob" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-light-pink rounded-full blur-blob opacity-40" />

      <div className="container mx-auto px-6 relative z-10 pb-24 lg:pb-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <p className="text-primary font-medium mb-4 animate-fade-up opacity-0 delay-100">
              Добро пожаловать
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 animate-fade-up opacity-0 delay-200">
              Привет, я{" "}
              <span className="text-primary">Мария</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-8 animate-fade-up opacity-0 delay-300">
              Мастер массажа и эстетики тела. Помогаю обрести гармонию, красоту и здоровье через профессиональный массаж и уход
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-slide-up opacity-0 delay-400">
              <Button variant="hero" size="xl" asChild>
                <a href="#about">Узнать обо мне</a>
              </Button>
              <Button variant="outline" size="xl" className="rounded-2xl" asChild>
                <a href="#contact">Связаться</a>
              </Button>
            </div>
          </div>

          {/* Avatar/Illustration */}
          <div className="flex-1 flex justify-center animate-scale-in opacity-0 delay-500">
            <div className="relative">
              <div className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full bg-gradient-to-br from-light-pink via-blush to-soft-peach shadow-medium flex items-center justify-center animate-float">
                <div className="w-[90%] h-[90%] rounded-full bg-card shadow-soft flex items-center justify-center">
                  <span className="font-serif text-6xl md:text-7xl lg:text-8xl text-primary">М</span>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-primary/20 rounded-full animate-float" style={{ animationDelay: '1s' }} />
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-blush/50 rounded-full animate-float" style={{ animationDelay: '2s' }} />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-4 lg:bottom-10 left-1/2 -translate-x-1/2 animate-fade-in opacity-0 delay-600 z-20">
          <a href="#about" className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-sm hidden sm:block">Прокрутить вниз</span>
            <ArrowDown className="w-5 h-5 animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
