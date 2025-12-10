import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-5 sm:p-8 border border-border">
        {step === 1 && (
          <div className="text-center">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">💆‍♀️</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Добро пожаловать в Афродита
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
              Массажный салон премиум-класса с удобной онлайн-записью
            </p>
            <button
              onClick={handleNext}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition text-base sm:text-lg"
            >
              Далее
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">📅</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Легкая запись
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
              Выберите услугу, мастера и удобное время всего за несколько кликов
            </p>
            <div className="flex gap-3 sm:gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-accent transition text-sm sm:text-base"
              >
                Назад
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition text-sm sm:text-base"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🎁</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Бонусная система
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
              Получайте бонусы за каждое посещение и используйте их для оплаты услуг
            </p>
            <div className="flex gap-3 sm:gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-accent transition text-sm sm:text-base"
              >
                Назад
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition text-sm sm:text-base"
              >
                Начать
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

