import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blogPosts } from "@/data/blogPosts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Blog = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <section className="py-20 md:py-28 bg-gradient-to-b from-peach/10 to-white relative overflow-hidden">
          {/* Background Decorations */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-primary/10 to-blush/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-gradient-to-br from-peach/20 to-primary/10 rounded-full blur-3xl"></div>

          <div className="container mx-auto px-5 md:px-8 relative z-10">
            {/* Section Header */}
            <div className="mb-12 md:mb-16 animate-fade-in">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                Блог
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
                Все статьи
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                Полезные статьи о массаже, красоте, здоровье и уходе за телом
              </p>
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
                  <Link to={`/blog/${post.id}`}>
                    <div className="relative overflow-hidden aspect-[4/3]">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      {/* Category Badge */}
                      <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm text-primary text-sm font-medium rounded-full shadow-sm">
                        {post.category}
                      </span>
                    </div>
                  </Link>

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
                    <Link to={`/blog/${post.id}`}>
                      <h3 className="font-display font-semibold text-xl text-foreground mb-3 group-hover:text-primary transition-colors duration-300 line-clamp-2">
                        {post.title}
                      </h3>
                    </Link>

                    {/* Excerpt */}
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3">
                      {post.excerpt}
                    </p>

                    {/* Read More Link */}
                    <Link to={`/blog/${post.id}`}>
                      <Button variant="ghost" className="p-0 h-auto text-primary font-medium text-sm group/link hover:bg-transparent">
                        Читать далее
                        <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                      </Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;

