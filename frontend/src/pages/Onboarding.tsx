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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {step === 1 && (
          <div className="text-center">
            <div className="text-6xl mb-4">💆‍♀️</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Добро пожаловать в Афродита
            </h1>
            <p className="text-gray-600 mb-8">
              Массажный салон премиум-класса с удобной онлайн-записью
            </p>
            <button
              onClick={handleNext}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              Далее
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <div className="text-6xl mb-4">📅</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Легкая запись
            </h1>
            <p className="text-gray-600 mb-8">
              Выберите услугу, мастера и удобное время всего за несколько кликов
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Назад
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Бонусная система
            </h1>
            <p className="text-gray-600 mb-8">
              Получайте бонусы за каждое посещение и используйте их для оплаты услуг
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Назад
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
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

