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
import { Button } from '../ui/button';


export default function ProductSwiper({product}: {product: Product}) {
    const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const productImages = product.productImages.filter((image, index, self) =>
                        index === self.findIndex((img) => img.imageUrl === image.imageUrl)
                    );
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl">

                {/* Main Swiper */}
                <div className="mb-6 relative group">
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
                            <div className="aspect-square relative">
                            <Image
                                src={image.imageUrl ? image.imageUrl : '/sadly-no-image.png'}
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
            <Button
              size="icon"
              variant="secondary"
                        className="custom-prev absolute left-3 top-1/2 opacity-0 group-hover:opacity-100 hover:-translate-x-1 -translate-y-1/2 z-10 p-3 transition-all cursor-pointer hover:scale-100"
                        aria-label="Previous image"
                    >
                        <ChevronLeft size={24} className="" />
                    </Button>
                    
                    <Button
              size="icon"
              variant="secondary"
                        className="custom-next absolute right-3 top-1/2 opacity-0 group-hover:opacity-100 hover:translate-x-1 -translate-y-1/2 z-10 p-3 transition-all cursor-pointer hover:scale-100"
                        aria-label="Next image"
                    >
                        <ChevronRight size={24} className="" />
                    </Button>

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
                        <SwiperSlide key={image.id}>
                        <div
                            className={`cursor-pointer rounded-lg overflow-hidden brightness-[0.5] transition-all ${
                            index === activeIndex
                                && 'brightness-[1]'
                                
                            }`}
                        >
                            <img
                                src={image.imageUrl ? image.imageUrl : '/sadly-no-image.png'}
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