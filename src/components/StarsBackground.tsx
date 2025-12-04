import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  tailLength: number;
  active: boolean;
}

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const starCount = Math.floor((canvas.width * canvas.height) / 3000);
      starsRef.current = [];

      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.5,
        });
      }
    };

    const createShootingStar = () => {
      const startX = Math.random() * canvas.width * 1.5 - canvas.width * 0.25;
      const startY = Math.random() * canvas.height * 0.6;
      const angle = Math.PI / 6 + Math.random() * Math.PI / 6;

      return {
        x: startX,
        y: startY,
        length: Math.random() * 100 + 80,
        speed: Math.random() * 8 + 6,
        angle: angle,
        opacity: 1,
        tailLength: Math.random() * 60 + 40,
        active: true,
      };
    };

    const drawStars = () => {
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      starsRef.current.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        if (star.size > 1) {
          ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * 0.2})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (Math.random() < 0.015) {
        shootingStarsRef.current.push(createShootingStar());
      }

      shootingStarsRef.current = shootingStarsRef.current.filter(star => {
        if (!star.active) return false;

        star.x += Math.cos(star.angle) * star.speed;
        star.y += Math.sin(star.angle) * star.speed;
        star.opacity -= 0.008;

        if (star.opacity <= 0 || star.x > canvas.width + 200 || star.y > canvas.height + 200) {
          star.active = false;
          return false;
        }

        const gradient = ctx.createLinearGradient(
          star.x,
          star.y,
          star.x - Math.cos(star.angle) * star.tailLength,
          star.y - Math.sin(star.angle) * star.tailLength
        );

        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        gradient.addColorStop(0.1, `rgba(200, 220, 255, ${star.opacity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(150, 180, 255, ${star.opacity * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(
          star.x - Math.cos(star.angle) * star.tailLength,
          star.y - Math.sin(star.angle) * star.tailLength
        );
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        return true;
      });

      animationRef.current = requestAnimationFrame(drawStars);
    };

    resizeCanvas();
    animationRef.current = requestAnimationFrame(drawStars);

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: '#0a0e27' }}
    />
  );
}
