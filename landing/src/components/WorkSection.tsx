import { Heart, Sparkles, Scissors, Flower2, Droplets, Hand } from "lucide-react";

const WorkSection = () => {
  const works = [
    {
      icon: Hand,
      title: "Классический массаж",
      description: "Расслабляющий и лечебный массаж всего тела для снятия напряжения и улучшения самочувствия",
    },
    {
      icon: Heart,
      title: "Антицеллюлитный массаж",
      description: "Профессиональная коррекция фигуры и улучшение состояния кожи с использованием специальных техник",
    },
    {
      icon: Sparkles,
      title: "Массаж лица",
      description: "Омолаживающий и лифтинг-массаж для подтяжки кожи и улучшения цвета лица",
    },
    {
      icon: Droplets,
      title: "Ароматерапия",
      description: "Массаж с использованием натуральных эфирных масел для глубокой релаксации и восстановления",
    },
    {
      icon: Flower2,
      title: "Уход за телом",
      description: "Обертывания, скрабирование и другие процедуры для красоты и здоровья кожи",
    },
    {
      icon: Scissors,
      title: "Корректирующий массаж",
      description: "Специализированные техники для работы с проблемными зонами и восстановления тонуса",
    },
  ];

  return (
    <section id="work" className="py-20 md:py-32 gradient-soft">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-3">Мои услуги</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Виды массажа и ухода
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Профессиональные услуги массажа и эстетики тела для вашего здоровья, красоты и релаксации
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {works.map((work, index) => (
            <div
              key={index}
              className="group p-6 md:p-8 bg-card rounded-2xl shadow-soft hover-lift hover-glow cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-light-pink flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <work.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                {work.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {work.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkSection;
