import { DetailsSkeleton, BreadcrumbSkeleton, ImageSkeleton, PriceHeroSkeleton } from './Skeletons';

export default function CardPageLoading() {
    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            <BreadcrumbSkeleton />

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* Left Column */}
                <div className='md:col-span-1'>
                    <div className='md:sticky md:top-20 flex flex-col gap-4'>
                        <ImageSkeleton />
                        <div className='hidden md:block px-2'>
                            <PriceHeroSkeleton />
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <DetailsSkeleton />
            </div>
        </main>
    );
}