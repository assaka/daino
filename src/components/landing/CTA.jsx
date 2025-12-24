import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight } from 'lucide-react';

export default function CTA() {
    return (
        <section className="py-32 relative overflow-hidden bg-neutral-100">
            <div className="max-w-6xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Main CTA Box */}
                    <div className="bg-indigo-900 p-12 md:p-16 rounded-2xl relative">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2" />
                        <div className="absolute -top-5 left-8 bg-indigo-500 text-white px-6 py-2 font-bold text-lg rounded-full shadow-lg ring-4 ring-white z-10">
                            LIMITED TIME OFFER
                        </div>

                        <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight text-white">
                            Stop Coding.
                            <br />
                            Start Building.
                        </h2>

                        <p className="text-2xl md:text-3xl mb-12 max-w-3xl font-medium text-white/90">
                            Battle-tested templates + AI customization + Plugin generator = Your dream store in minutes
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
                            <Button
                                size="lg"
                                className="bg-white hover:bg-indigo-50 text-indigo-900 px-12 py-8 text-xl rounded-full font-bold transition-all group w-full sm:w-auto shadow-xl"
                            >
                                START FREE TRIAL
                                <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-2 transition-transform" />
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="bg-transparent border-2 border-white/50 text-white hover:bg-white/10 px-12 py-8 text-xl rounded-full font-bold transition-all w-full sm:w-auto"
                            >
                                SEE IT IN ACTION
                            </Button>
                        </div>

                        {/* Trust badges */}
                        <div className="flex flex-wrap items-center justify-center gap-8 text-white/90 border-t border-white/30 pt-8">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-white rounded-full" />
                                <span className="font-medium">10,000+ Stores</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-white rounded-full" />
                                <span className="font-medium">No Credit Card</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-white rounded-full" />
                                <span className="font-medium">Pay as you Go</span>
                            </div>
                        </div>
                    </div>

                </motion.div>
            </div>
        </section>
    );
}