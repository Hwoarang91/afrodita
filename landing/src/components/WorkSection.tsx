import { Link } from "react-router-dom";
import { services } from "@/data/services";

const WorkSection = () => {
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
          {services.map((service, index) => {
            const ServiceIcon = service.icon;
            return (
              <Link
                key={service.id}
                to={`/service/${service.id}`}
                className="group p-6 md:p-8 bg-card rounded-2xl shadow-soft hover-lift hover-glow cursor-pointer block"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-xl bg-light-pink flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <ServiceIcon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {service.shortDescription}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-primary/10">
                  <span className="text-primary font-semibold text-lg">
                    {service.price.toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {service.duration} мин
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WorkSection;
