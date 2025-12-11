import { useParams, Link } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlogPostById, blogPosts } from "@/data/blogPosts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useEffect } from "react";

const BlogPost = () => {
  const { id } = useParams<{ id: string }>();
  const postId = id ? parseInt(id, 10) : null;
  const post = postId ? getBlogPostById(postId) : null;

  // Находим соседние статьи
  const currentIndex = postId ? blogPosts.findIndex(p => p.id === postId) : -1;
  const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
  const nextPost = currentIndex >= 0 && currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;

  useEffect(() => {
    if (post) {
      window.scrollTo(0, 0);
    }
  }, [post]);

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground mb-4">
              Статья не найдена
            </h1>
            <Link to="/blog">
              <Button>Вернуться к статьям</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Простой парсер markdown для отображения контента
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let currentParagraph: string[] = [];
    let currentListItems: string[] = [];
    let listKey = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        if (currentListItems.length > 0) {
          elements.push(
            <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
              {currentListItems.map((item, i) => (
                <li key={i} className="ml-4">{item}</li>
              ))}
            </ul>
          );
          currentListItems = [];
        }
        if (currentParagraph.length > 0) {
          elements.push(<p key={`p-${index}`} className="mb-4 text-muted-foreground leading-relaxed">{currentParagraph.join(' ')}</p>);
          currentParagraph = [];
        }
        elements.push(
          <h2 key={`h2-${index}`} className="font-display text-3xl font-bold text-foreground mt-8 mb-4">
            {trimmed.substring(2)}
          </h2>
        );
      } else if (trimmed.startsWith('## ')) {
        if (currentListItems.length > 0) {
          elements.push(
            <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
              {currentListItems.map((item, i) => (
                <li key={i} className="ml-4">{item}</li>
              ))}
            </ul>
          );
          currentListItems = [];
        }
        if (currentParagraph.length > 0) {
          elements.push(<p key={`p-${index}`} className="mb-4 text-muted-foreground leading-relaxed">{currentParagraph.join(' ')}</p>);
          currentParagraph = [];
        }
        elements.push(
          <h3 key={`h3-${index}`} className="font-display text-2xl font-semibold text-foreground mt-6 mb-3">
            {trimmed.substring(3)}
          </h3>
        );
      } else if (trimmed.startsWith('- ')) {
        if (currentParagraph.length > 0) {
          elements.push(<p key={`p-${index}`} className="mb-4 text-muted-foreground leading-relaxed">{currentParagraph.join(' ')}</p>);
          currentParagraph = [];
        }
        currentListItems.push(trimmed.substring(2));
      } else if (trimmed.startsWith('### ')) {
        if (currentListItems.length > 0) {
          elements.push(
            <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
              {currentListItems.map((item, i) => (
                <li key={i} className="ml-4">{item}</li>
              ))}
            </ul>
          );
          currentListItems = [];
        }
        if (currentParagraph.length > 0) {
          elements.push(<p key={`p-${index}`} className="mb-4 text-muted-foreground leading-relaxed">{currentParagraph.join(' ')}</p>);
          currentParagraph = [];
        }
        elements.push(
          <h4 key={`h4-${index}`} className="font-display text-xl font-semibold text-foreground mt-4 mb-2">
            {trimmed.substring(4)}
          </h4>
        );
      } else if (trimmed === '') {
        if (currentListItems.length > 0) {
          elements.push(
            <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
              {currentListItems.map((item, i) => (
                <li key={i} className="ml-4">{item}</li>
              ))}
            </ul>
          );
          currentListItems = [];
        }
        if (currentParagraph.length > 0) {
          elements.push(<p key={`p-${index}`} className="mb-4 text-muted-foreground leading-relaxed">{currentParagraph.join(' ')}</p>);
          currentParagraph = [];
        }
      } else {
        if (currentListItems.length > 0) {
          elements.push(
            <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
              {currentListItems.map((item, i) => (
                <li key={i} className="ml-4">{item}</li>
              ))}
            </ul>
          );
          currentListItems = [];
        }
        currentParagraph.push(trimmed);
      }
    });

    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
          {currentListItems.map((item, i) => (
            <li key={i} className="ml-4">{item}</li>
          ))}
        </ul>
      );
    }
    if (currentParagraph.length > 0) {
      elements.push(<p key="p-final" className="mb-4 text-muted-foreground leading-relaxed">{currentParagraph.join(' ')}</p>);
    }

    return elements;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <article className="py-20 md:py-28 bg-gradient-to-b from-peach/10 to-white">
          <div className="container mx-auto px-5 md:px-8 max-w-4xl">
            {/* Back Button */}
            <Link to="/blog" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться к статьям
            </Link>

            {/* Header */}
            <div className="mb-8">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                {post.category}
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                {post.title}
              </h1>
              
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-6 text-muted-foreground mb-8">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {post.date}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {post.readTime}
                </span>
                {post.author && (
                  <span>Автор: {post.author}</span>
                )}
              </div>
            </div>

            {/* Featured Image */}
            <div className="relative overflow-hidden rounded-3xl mb-12 aspect-video">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder.svg';
                }}
              />
            </div>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <div className="text-lg text-muted-foreground leading-relaxed space-y-6">
                {renderContent(post.content)}
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-16 pt-8 border-t border-primary/10">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                {prevPost && (
                  <Link
                    to={`/blog/${prevPost.id}`}
                    className="group flex-1 p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-primary/5 hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <ArrowLeft className="w-4 h-4" />
                      Предыдущая статья
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                      {prevPost.title}
                    </h3>
                  </Link>
                )}
                {nextPost && (
                  <Link
                    to={`/blog/${nextPost.id}`}
                    className="group flex-1 p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-primary/5 hover:border-primary/20 transition-all text-right md:text-left"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 justify-end md:justify-start">
                      Следующая статья
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                      {nextPost.title}
                    </h3>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;

