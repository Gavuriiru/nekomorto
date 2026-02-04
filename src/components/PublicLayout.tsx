import { useLocation, Outlet } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const PublicLayout = () => {
  const location = useLocation();

  return (
    <LayoutGroup>
      <Header />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          variants={pageTransition}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
    </LayoutGroup>
  );
};

export default PublicLayout;
