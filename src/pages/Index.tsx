import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import carsPattern from "@/assets/cars-pattern.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-[#0A0A1A] lab-bg relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url(${carsPattern})`,
          backgroundSize: "400px",
          backgroundRepeat: "repeat",
        }}
      />
      <AnimatedAIChat />
    </div>
  );
};

export default Index;
