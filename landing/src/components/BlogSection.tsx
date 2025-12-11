import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

const blogPosts = [
  {
    id: 1,
    title: "Польза антицеллюлитного массажа для красоты тела",
    excerpt: "Как профессиональный массаж помогает улучшить состояние кожи, убрать целлюлит и обрести уверенность в себе.",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop",
    category: "Красота",
    date: "15 декабря 2024",
    readTime: "5 мин"
  },
  {
    id: 2,
    title: "Массаж лица: секреты омоложения и подтяжки",
    excerpt: "Почему лифтинг-массаж эффективнее дорогих кремов и как правильно ухаживать за кожей лица.",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=400&fit=crop",
    category: "Уход",
    date: "10 декабря 2024",
    readTime: "7 мин"
  },
  {
    id: 3,
    title: "Ароматерапия: сила эфирных масел для релаксации",
    excerpt: "Как правильно использовать натуральные масла в массаже для глубокого расслабления и восстановления энергии.",
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=400&fit=crop",
    category: "Релаксация",
    date: "5 декабря 2024",
    readTime: "6 мин"
  }
];

const BlogSection = () => {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-peach/10 to-white relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-primary/10 to-blush/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-48 h-48 bg-gradient-to-br from-peach/20 to-primary/10 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-5 md:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
          <div className="animate-fade-in">
            <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
              Блог
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Последние статьи
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Полезные статьи о массаже, красоте, здоровье и уходе за телом
            </p>
          </div>

          <Button variant="soft" className="self-start md:self-auto group">
            Все статьи
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        {/* Blog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {blogPosts.map((post, index) => (
            <article
              key={post.id}
              className="group bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-soft hover:shadow-lg transition-all duration-500 border border-primary/5 hover:border-primary/20 animate-fade-in"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Image */}
              <div className="relative overflow-hidden aspect-[4/3]">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* Category Badge */}
                <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm text-primary text-sm font-medium rounded-full shadow-sm">
                  {post.category}
                </span>
              </div>

              {/* Content */}
              <div className="p-6 md:p-8">
                {/* Meta */}
                <div className="flex items-center gap-4 text-muted-foreground text-sm mb-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {post.readTime}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-display font-semibold text-xl text-foreground mb-3 group-hover:text-primary transition-colors duration-300 line-clamp-2">
                  {post.title}
                </h3>

                {/* Excerpt */}
                <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3">
                  {post.excerpt}
                </p>

                {/* Read More Link */}
                <button className="inline-flex items-center text-primary font-medium text-sm group/link">
                  Читать далее
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Newsletter CTA */}
        <div className="mt-16 md:mt-20 bg-gradient-to-r from-primary/10 via-blush/20 to-peach/10 rounded-3xl p-8 md:p-12 text-center animate-fade-in">
          <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
            Подпишитесь на новости
          </h3>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Подпишитесь, чтобы получать советы по уходу за телом, секреты красоты и информацию о новых услугах
          </p>
          
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Ваш email"
              className="flex-1 px-6 py-3 bg-white/80 backdrop-blur-sm border border-primary/20 rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-300"
            />
            <Button variant="hero" className="px-8">
              Подписаться
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default BlogSection;
