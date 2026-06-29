// file: client/src/App.jsx

import { useEffect, useState } from "react";
import Lenis from "lenis";
import { AnimatePresence } from "framer-motion";
import Preloader from "./components/Preloader";

const App = () => {
  const [loading, setLoading] = useState(true);

  // hide preloader after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return (
    <>
      <AnimatePresence>{loading && <Preloader />}</AnimatePresence>

      <div className="min-h-screen bg-bg text-text">
        <h1 className="text-4xl font-bold p-8">CiviMap</h1>
        <div style={{ height: "200vh" }} className="p-8">
          Scroll down to test Lenis smooth scrolling…
        </div>
      </div>
    </>
  );
};

export default App;