import React from 'react';
import { motion } from 'framer-motion';

const stores = [
    { image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop", name: "Luxe Fashion", category: "Fashion" },
    { image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop", name: "TechHub", category: "Electronics" },
    { image: "https://images.unsplash.com/photo-1572584642822-6f8de0243c93?w=400&h=300&fit=crop", name: "Home & Living", category: "Home Decor" },
    { image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop", name: "Accessorize", category: "Accessories" },
    { image: "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&h=300&fit=crop", name: "Beauty Box", category: "Beauty" },
    { image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop", name: "Minimal Goods", category: "Lifestyle" },
    { image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop", name: "Audio World", category: "Electronics" },
    { image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop", name: "Sneaker Lab", category: "Footwear" },
];

export default function StoreGallery() {
    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <div className="inline-block bg-indigo-600 text-white px-4 py-2 font-bold text-sm mb-6 rounded-full">
                        STORE GALLERY
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-neutral-900 mb-4">
                        Created by our community
                    </h2>
                    <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                        Discover what others have built with DainoStore. Get inspired and start your own store today.
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {stores.map((store, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            className="group relative overflow-hidden rounded-2xl cursor-pointer"
                        >
                            <div className="aspect-[4/3] overflow-hidden">
                                <img
                                    src={store.image}
                                    alt={store.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <p className="text-white font-bold">{store.name}</p>
                                    <p className="text-white/70 text-sm">{store.category}</p>
                                </div>
                            </div>
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-neutral-700">
                                {store.category}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}