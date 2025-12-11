import { useParams, Link } from "react-router-dom";
import { Clock, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServiceById } from "@/data/services";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useEffect } from "react";

const ServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const serviceId = id ? parseInt(id, 10) : null;
  const service = serviceId ? getServiceById(serviceId) : null;

  useEffect(() => {
    if (service) {
      window.scrollTo(0, 0);
    }
  }, [service]);

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground mb-4">
              Услуга не найдена
            </h1>
            <Link to="/#work">
              <Button>Вернуться к услугам</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const ServiceIcon = service.icon;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <article className="py-20 md:py-28 bg-gradient-to-b from-peach/10 to-white">
          <div className="container mx-auto px-5 md:px-8 max-w-4xl">
            {/* Back Button */}
            <Link to="/#work" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться к услугам
            </Link>

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-light-pink flex items-center justify-center">
                  <ServiceIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-2">
                    {service.category}
                  </span>
                  <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                    {service.title}
                  </h1>
                </div>
              </div>
            </div>

            {/* Featured Image */}
            <div className="relative overflow-hidden rounded-3xl mb-12 aspect-video">
              <img
                src={service.image}
                alt={service.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder.svg';
                }}
              />
            </div>

            {/* Price and Duration */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="p-6 bg-card rounded-2xl shadow-soft border border-primary/5">
                <div className="text-muted-foreground text-sm mb-2">Стоимость</div>
                <div className="font-display text-3xl font-bold text-primary">
                  {service.price.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="p-6 bg-card rounded-2xl shadow-soft border border-primary/5">
                <div className="text-muted-foreground text-sm mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Длительность
                </div>
                <div className="font-display text-3xl font-bold text-foreground">
                  {service.duration} мин
                </div>
              </div>
            </div>

            {/* Full Description */}
            <div className="mb-12">
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
                Описание услуги
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {service.fullDescription}
              </p>
            </div>

            {/* Features */}
            <div className="mb-12">
              <h2 className="font-display text-2xl font-semibold text-foreground mb-6">
                Что включает процедура
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {service.features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-card rounded-xl shadow-soft border border-primary/5"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <div className="text-center">
              <Button variant="hero" size="lg" className="px-8" asChild>
                <a href="#contact">Записаться на процедуру</a>
              </Button>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default ServiceDetail;

