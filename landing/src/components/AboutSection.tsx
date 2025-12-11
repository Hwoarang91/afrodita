import { Heart, Sparkles, Award, Star } from "lucide-react";

const AboutSection = () => {
  const traits = [
    { icon: Heart, label: "Любовь к своему делу" },
    { icon: Sparkles, label: "Индивидуальный подход" },
    { icon: Award, label: "Профессионализм" },
    { icon: Star, label: "Забота о клиентах" },
  ];

  return (
    <section id="about" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Photo */}
          <div className="flex-1 flex justify-center">
            <div className="relative">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-br from-light-pink to-blush p-2 shadow-medium">
                <div className="w-full h-full rounded-full bg-warm-beige flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                    <span className="font-serif text-5xl md:text-6xl text-primary/60">💆‍♀️</span>
                  </div>
                </div>
              </div>
              {/* Decorative ring */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 scale-110" />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <p className="text-primary font-medium mb-3">Обо мне</p>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              О мастере
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              Я — Мария, профессиональный мастер массажа с более чем 8-летним опытом работы. 
              Моя миссия — помочь вам обрести гармонию тела и души, восстановить энергию и 
              почувствовать себя по-настоящему красивыми.
            </p>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Я использую только проверенные техники массажа и качественные натуральные масла. 
              Каждая процедура — это индивидуальный подход, учитывающий ваши потребности и особенности. 
              Ваше здоровье и красота — мой главный приоритет.
            </p>

            {/* Traits */}
            <div className="grid grid-cols-2 gap-4">
              {traits.map((trait, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-xl bg-card shadow-soft hover-lift"
                >
                  <div className="w-10 h-10 rounded-full bg-light-pink flex items-center justify-center">
                    <trait.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{trait.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
