import { GraduationCap, BookOpen, Award, FileCheck } from "lucide-react";

const EducationSection = () => {
  const educations = [
    {
      icon: GraduationCap,
      title: "Школа массажа и эстетики",
      subtitle: "Профессиональное обучение",
      period: "2016 - 2017",
      description: "Диплом мастера классического и лечебного массажа",
    },
    {
      icon: BookOpen,
      title: "Курс антицеллюлитного массажа",
      subtitle: "Международная школа",
      period: "2018",
      description: "Сертификат по коррекции фигуры и лимфодренажу",
    },
    {
      icon: Award,
      title: "Массаж лица и шеи",
      subtitle: "Продвинутый курс",
      period: "2019",
      description: "Сертификат по лифтинг-массажу и омоложению",
    },
    {
      icon: FileCheck,
      title: "Ароматерапия и эфирные масла",
      subtitle: "Специализированное обучение",
      period: "2020",
      description: "Профессиональный сертификат по ароматерапии",
    },
  ];

  const certificates = [
    "Диплом мастера массажа",
    "Сертификат антицеллюлитного массажа",
    "Сертификат лифтинг-массажа",
    "Сертификат ароматерапии",
  ];

  return (
    <section id="education" className="py-20 md:py-32 gradient-soft">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-3">Образование</p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Образование и дипломы
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Постоянное совершенствование техник и изучение новых методик для лучшего результата
          </p>
        </div>

        {/* Education Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {educations.map((edu, index) => (
            <div
              key={index}
              className="bg-card p-6 md:p-8 rounded-2xl shadow-soft hover-lift group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-light-pink flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <edu.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="font-serif text-lg font-semibold text-foreground">
                      {edu.title}
                    </h3>
                    <span className="text-sm text-primary bg-light-pink px-3 py-1 rounded-full">
                      {edu.period}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">{edu.subtitle}</p>
                  <p className="text-foreground">{edu.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Certificates Gallery */}
        <div className="text-center">
          <h3 className="font-serif text-2xl font-semibold text-foreground mb-8">
            Мои сертификаты
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {certificates.map((cert, index) => (
              <div
                key={index}
                className="aspect-[4/3] bg-card rounded-xl shadow-soft p-4 flex items-center justify-center hover-lift cursor-pointer group"
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-light-pink flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <FileCheck className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{cert}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EducationSection;
