import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import WorkSection from "@/components/WorkSection";
import GallerySection from "@/components/GallerySection";
import AchievementsSection from "@/components/AchievementsSection";
import EducationSection from "@/components/EducationSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import BlogSection from "@/components/BlogSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import VideoPreloader from "@/components/VideoPreloader";

const Index = () => {
  const isMobile = useIsMobile();
  // Показываем контент по умолчанию, если не мобильное устройство
  const [showContent, setShowContent] = useState(() => {
    // Проверяем при инициализации
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // Десктоп по умолчанию
    }
    return true; // SSR - показываем контент
  });

  useEffect(() => {
    // На десктопе показываем контент сразу
    if (isMobile === false) {
      setShowContent(true);
    } else if (isMobile === true) {
      // На мобильных ждем окончания видео
      setShowContent(false);
    }
    // Если isMobile === undefined, оставляем текущее состояние
  }, [isMobile]);

  const handleVideoEnd = () => {
    setShowContent(true);
  };

  const mainContent = (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <AboutSection />
      <WorkSection />
      <GallerySection />
      <AchievementsSection />
      <EducationSection />
      <TestimonialsSection />
      <BlogSection />
      <ContactSection />
      <Footer />
    </main>
  );

  return (
    <>
      <VideoPreloader onVideoEnd={handleVideoEnd} videoPath="/video.mp4" />
      {showContent && mainContent}
    </>
  );
};

export default Index;
