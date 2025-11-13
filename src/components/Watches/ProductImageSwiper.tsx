"use client"

import Image from 'next/image';
import React, { useState } from 'react';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/thumbs';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Thumbs, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Product } from '@/app/watches/type';


export default function ProductSwiper({product}: {product: Product}) {
    const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const productImages = product.productImages.filter((image, index, self) =>
                        index === self.findIndex((img) => img.imageUrl === image.imageUrl)
                    );
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl rounded-lg">

                {/* Main Swiper */}
                <div className="mb-6 relative">
                    <Swiper
                        modules={[Navigation, Pagination, Thumbs, Keyboard]}
                        spaceBetween={10}
                        navigation={{
                        prevEl: '.custom-prev',
                        nextEl: '.custom-next',
                        }}
                        pagination={{ 
                        clickable: true,
                        dynamicBullets: true 
                        }}
                        thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
                        keyboard={{
                        enabled: true,
                        onlyInViewport: true,
                        }}
                        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                        className="rounded-lg"
                        style={{
                        '--swiper-pagination-color': '#3f3f46',
                        } as React.CSSProperties}
                    >
                        {productImages.map((image) => (
                        <SwiperSlide key={image.id}>
                            <div className="aspect-square bg-gray-100 relative">
                            <Image
                                src={image.imageUrl || ''}
                                alt={`Picture of ${product.watch.brand.name} - ${product.watch.model}`}
                                className="w-full h-full object-cover"
                                fill
                                unoptimized
                            />
                            </div>
                        </SwiperSlide>
                        ))}
                    </Swiper>

                    {/* Custom Navigation Buttons with Lucide Icons */}
                    <button 
                        className="custom-prev absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 p-3 rounded-full shadow-lg transition-all hover:border-zinc-700 border-2 cursor-pointer"
                        aria-label="Previous image"
                    >
                        <ChevronLeft size={24} className="text-gray-800" />
                    </button>
                    
                    <button 
                        className="custom-next absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 p-3 rounded-full shadow-lg transition-all hover:border-zinc-700 border-2 cursor-pointer"
                        aria-label="Next image"
                    >
                        <ChevronRight size={24} className="text-gray-800" />
                    </button>

                    {/* Image Counter - Fixed position, doesn't move with slides */}
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-10 pointer-events-none">
                        {activeIndex + 1} / {productImages.length}
                    </div>
                </div>

                {/* Thumbnail Swiper */}
                <Swiper
                    onSwiper={setThumbsSwiper}
                    spaceBetween={12}
                    slidesPerView={5}
                    watchSlidesProgress={true}
                    className="mb-6"
                    breakpoints={{
                        320: {
                            slidesPerView: 3,
                        },
                        640: {
                            slidesPerView: 4,
                        },
                        768: {
                            slidesPerView: 5,
                        },
                    }}
                >
                {productImages.map((image, index) => (
                        <SwiperSlide key={image.id} className="height-2">
                        <div
                            className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            index === activeIndex
                                ? 'border-zinc-700 ring-2 ring-blue-200'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            <img
                                src={image.imageUrl || ''}
                                alt={`${index + 1}: Picture of ${product.watch.brand.name} - ${product.watch.model}`}
                                className="w-full aspect-square object-cover"
                            />
                        </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

        </div>
    );
}