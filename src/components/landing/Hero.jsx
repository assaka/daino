import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Hero() {
    const [prompt, setPrompt] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentTitleIndex, setCurrentTitleIndex] = useState(0);

    const examplePrompts = [
        "Create a fashion store with a minimalist layout",
        "Add a wishlist plugin with heart icons",
        "Translate my store to Spanish and French",
        "Make the layout more spacious and modern"
    ];

    const titleVariants = [
        "you can imagine",
        "that converts",
        "in any language",
        "in minutes",
        "without coding",
        "and AI powered",
        "that stands out",
        "lightning fast",
        "that scales",
        "drag & drop ready",
        "fully responsive",
        "SEO optimized",
        "mobile first",
        "pixel perfect",
        "analytics included",
        "in one click",
        "your way",
        "super integrated"
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTitleIndex((prev) => (prev + 1) % titleVariants.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim()) {
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setPrompt('');
            }, 2000);
        }
    };

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50 text-slate-900 pt-20">

            {/* E-commerce themed background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Subtle floating icons - shopping bags, carts, tags */}
                <svg className="absolute w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="ecommerce-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                            {/* Shopping bag */}
                            <path d="M20 35 L20 25 C20 20 25 15 30 15 C35 15 40 20 40 25 L40 35 M15 35 L45 35 L45 55 L15 55 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                            {/* Price tag */}
                            <path d="M75 20 L95 20 L95 40 L80 55 L65 40 Z M85 30 A2 2 0 1 0 85 30.01" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                            {/* Cart */}
                            <path d="M20 85 L25 85 L35 100 L55 100 M30 90 L55 90 L52 100 M35 107 A3 3 0 1 0 35 107.01 M52 107 A3 3 0 1 0 52 107.01" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                            {/* Star/sparkle */}
                            <path d="M90 80 L92 88 L100 90 L92 92 L90 100 L88 92 L80 90 L88 88 Z" fill="none" stroke="currentColor" strokeWidth="1"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#ecommerce-pattern)" />
                </svg>
                {/* Soft gradient overlays */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-50 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-50 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-5xl md:text-6xl lg:text-8xl font-black mb-8 leading-tight text-slate-900"
                >
                    Build any store
                    <br />
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={currentTitleIndex}
                            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                            transition={{ duration: 0.5 }}
                            className="text-indigo-600 inline-block text-4xl md:text-5xl lg:text-7xl"
                        >
                            {titleVariants[currentTitleIndex]}
                        </motion.span>
                    </AnimatePresence>
                    <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                        className="inline-block w-[3px] h-14 bg-slate-900 ml-2 align-middle"
                    />
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-lg text-slate-400 font-bold mb-8"
                >
                    "Don't build from scratch - use ai and enhance what works"
                </motion.p>

                {/* AI Prompt Input */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-6"
                >
                    <form onSubmit={handleSubmit}>
                        <div className="relative bg-white rounded-2xl p-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 transition-shadow duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                            <input
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe your dream store..."
                                className="w-full bg-transparent px-6 py-4 text-lg text-slate-900 placeholder:text-slate-400 outline-none font-medium"
                            />
                            <div className="flex items-center gap-3 px-2 pb-2">
                                <button type="button" className="text-slate-400 hover:text-slate-900 text-sm px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors font-medium">
                                    + Advanced
                                </button>
                                <div className="flex-1" />
                                <Button
                                    type="submit"
                                    disabled={!prompt.trim() || isTyping}
                                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 py-2 font-bold disabled:opacity-50 shadow-lg shadow-slate-200 transition-all"
                                >
                                    {isTyping ? (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                        />
                                    ) : (
                                        <>
                                            <span className="mr-2">Create</span>
                                            <Send className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </motion.div>

                {/* Quick prompts */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="flex flex-wrap justify-center gap-2"
                >
                    {examplePrompts.slice(0, 3).map((example, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setPrompt(example)}
                            className="text-xs bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 transition-colors shadow-sm font-medium"
                        >
                            {example}
                        </button>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}