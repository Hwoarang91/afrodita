import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "./ui/button";

const testimonials = [
  {
    id: 1,
    name: "Елена Смирнова",
    role: "Постоянный клиент",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    text: "Мария — настоящий профессионал! После каждого сеанса чувствую себя обновлённой и полной энергии. Массаж невероятно расслабляющий и эффективный!",
    rating: 5
  },
  {
    id: 2,
    name: "Ольга Петрова",
    role: "Клиент",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    text: "Антицеллюлитный массаж просто творит чудеса! Результат виден уже после нескольких сеансов. Мария знает своё дело и делает это с любовью.",
    rating: 5
  },
  {
    id: 3,
    name: "Анна Иванова",
    role: "Постоянный клиент",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    text: "Массаж лица от Марии — это что-то невероятное! Кожа стала более упругой и сияющей. Очень внимательный и профессиональный подход к каждому клиенту.",
    rating: 5
  },
  {
    id: 4,
    name: "Мария Волкова",
    role: "Клиент",
    avatar: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop&crop=face",
    text: "Прихожу к Марии уже больше года. Каждый раз — это час полной релаксации и заботы о себе. Атмосфера в студии уютная, а руки мастера — золотые!",
    rating: 5
  }
];

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-white to-blush/20 overflow-hidden">
      <div className="container mx-auto px-5 md:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 animate-fade-in">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            Отзывы
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Что говорят клиенты
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Отзывы моих дорогих клиентов, которые доверили мне заботу о своей красоте и здоровье
          </p>
        </div>

        {/* Slider Container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Main Card */}
          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-8 md:p-12 border border-primary/10">
            {/* Quote Icon */}
            <div className="absolute -top-6 left-8 md:left-12 w-12 h-12 bg-gradient-to-br from-primary to-blush rounded-2xl flex items-center justify-center shadow-lg">
              <Quote className="w-6 h-6 text-white" />
            </div>

            {/* Content */}
            <div className="pt-4">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-peach/30 rounded-full blur-lg transform scale-110"></div>
                    <img
                      src={testimonials[currentIndex].avatar}
                      alt={testimonials[currentIndex].name}
                      className="relative w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  </div>
                </div>

                {/* Text Content */}
                <div className="flex-1 text-center md:text-left">
                  {/* Rating */}
                  <div className="flex justify-center md:justify-start gap-1 mb-4">
                    {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-5 h-5 text-yellow-400 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>

                  {/* Quote Text */}
                  <p className="text-foreground text-lg md:text-xl leading-relaxed mb-6 italic">
                    "{testimonials[currentIndex].text}"
                  </p>

                  {/* Author */}
                  <div>
                    <h4 className="font-display font-semibold text-foreground text-lg">
                      {testimonials[currentIndex].name}
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {testimonials[currentIndex].role}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="soft"
              size="icon"
              onClick={goToPrevious}
              className="w-12 h-12 rounded-full shadow-soft hover:shadow-md transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "bg-primary w-8"
                      : "bg-primary/30 hover:bg-primary/50"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="soft"
              size="icon"
              onClick={goToNext}
              className="w-12 h-12 rounded-full shadow-soft hover:shadow-md transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Background Decorations */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-primary/10 to-peach/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-0 top-1/4 w-48 h-48 bg-gradient-to-br from-blush/20 to-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
