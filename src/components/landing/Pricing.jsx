import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from 'lucide-react';

const getPlans = (freeCredits) => [
    {
        name: "Free Setup",
        price: "0",
        description: "Configure your shop for free",
        features: [
            "Free account registration",
            `${freeCredits} free credits included`,
            "Full store configuration",
            "Product & catalog management",
            "Payment & shipping setup",
            "Template customization",
            "Mobile responsive design",
            "Unlimited preview & testing"
        ]
    },
    {
        name: "Go Live",
        price: "3",
        priceNote: "30 days",
        description: "1 credit = 1 day live",
        features: [
            "Everything in Free Setup",
            "30 credits = 30 days published",
            "Live production storefront",
            "Custom domain support",
            "SSL certificate included",
            "Full e-commerce functionality",
            "Community support"
        ],
        popular: true
    },
    {
        name: "AI Enhancements",
        price: "Pay as you go",
        description: "Enhance your store with AI-powered features",
        features: [
            "AI translations (multi-language)",
            "AI workspace assistant",
            "AI product descriptions",
            "AI image generation",
            "AI content optimization",
            "Only pay for what you use",
            "No monthly commitments"
        ]
    }
];

export default function Pricing() {
    const [freeCredits, setFreeCredits] = useState(30);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/credits/pricing`)
            .then(res => res.json())
            .then(data => {
                if (data.freeCredits) {
                    setFreeCredits(data.freeCredits);
                }
            })
            .catch(() => {}); // Keep default on error
    }, []);

    const plans = getPlans(freeCredits);

    return (
        <section className="py-32 bg-white relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="mb-20"
                >
                    <div className="inline-block bg-indigo-100 text-indigo-700 px-4 py-2 font-bold text-sm mb-6 rounded-full">
                        FREE TO START
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black mb-6 text-neutral-900">
                        Free Setup
                    </h2>
                    <p className="text-xl text-neutral-600 max-w-2xl">
                        Set up your store at no cost. Publishing costs $3 for 30 days. AI features billed by usage.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`
                                relative rounded-2xl p-10 border transition-all duration-300 shadow-sm hover:shadow-lg h-full flex flex-col
                                ${plan.popular
                                ? 'bg-indigo-900 text-white border-transparent scale-105 shadow-xl'
                                : 'bg-neutral-50 border-neutral-200 hover:border-slate-400'
                            }
                            `}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 -right-4 bg-white text-neutral-900 px-4 py-2 text-sm font-bold rounded-full shadow-md">
                                    ★ BEST VALUE
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className={`text-3xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-neutral-900'}`}>
                                    {plan.name}
                                </h3>
                                <p className={`mb-6 ${plan.popular ? 'text-white/80' : 'text-neutral-600'}`}>
                                    {plan.description}
                                </p>
                                <div className="flex items-end gap-2">
                                    {!isNaN(plan.price) && (
                                        <span className={`text-4xl font-black ${plan.popular ? 'text-white' : 'text-neutral-900'}`}>$</span>
                                    )}
                                    <span className={`${isNaN(plan.price) ? 'text-3xl' : 'text-7xl'} font-black ${plan.popular ? 'text-white' : 'text-indigo-900'}`}>
                                        {plan.price}
                                    </span>
                                    {plan.priceNote && (
                                        <span className={`mb-3 ${plan.popular ? 'text-white/70' : 'text-neutral-500'}`}>{plan.priceNote}</span>
                                    )}
                                </div>
                            </div>

                            <ul className="space-y-3 mb-8 flex-grow">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.popular ? 'text-white/80' : 'text-indigo-900'}`} />
                                        <span className={plan.popular ? 'text-white/90' : 'text-neutral-700'}>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button
                                className={`
                                    w-full py-6 text-lg rounded-full font-bold transition-all duration-300
                                    ${plan.popular
                                    ? 'bg-white hover:bg-neutral-100 text-neutral-900'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }
                                `}
                            >
                                {plan.name === "Free Setup" ? "START FREE" : plan.name === "Go Live" ? "GO LIVE" : "EXPLORE AI"}
                            </Button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}