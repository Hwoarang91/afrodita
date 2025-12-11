import { Award, Trophy, Target, Sparkles } from "lucide-react";

const AchievementsSection = () => {
  const achievements = [
    {
      year: "2024",
      title: "Мастер года по массажу",
      description: "Признание профессионального сообщества и благодарность клиентов",
      icon: Trophy,
    },
    {
      year: "2023",
      title: "1000+ довольных клиентов",
      description: "Достигнута важная веха — более тысячи успешных процедур",
      icon: Target,
    },
    {
      year: "2022",
      title: "Сертификат по антицеллюлитному массажу",
      description: "Профессиональная сертификация по коррекции фигуры",
      icon: Award,
    },
    {
      year: "2021",
      title: "Открытие собственной студии",
      description: "Реализация мечты — создание пространства для красоты и здоровья",
      icon: Sparkles,
    },
  ];

  return (
    <section id="achievements" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-3">Достижения</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Мои успехи
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Профессиональный путь, наполненный обучением, практикой и благодарностью клиентов
          </p>
        </div>

        {/* Timeline */}
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-blush to-light-pink" />

            {achievements.map((achievement, index) => (
              <div
                key={index}
                className={`relative flex items-center gap-6 md:gap-12 mb-12 last:mb-0 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Content */}
                <div className={`flex-1 ${index % 2 === 0 ? "md:text-right" : "md:text-left"} pl-16 md:pl-0`}>
                  <div className="bg-card p-6 rounded-2xl shadow-soft hover-lift">
                    <span className="inline-block px-3 py-1 bg-light-pink text-primary text-sm font-medium rounded-full mb-3">
                      {achievement.year}
                    </span>
                    <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                      {achievement.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {achievement.description}
                    </p>
                  </div>
                </div>

                {/* Icon */}
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-12 h-12 rounded-full bg-primary shadow-glow flex items-center justify-center z-10">
                  <achievement.icon className="w-5 h-5 text-primary-foreground" />
                </div>

                {/* Empty space for alternating layout */}
                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AchievementsSection;
