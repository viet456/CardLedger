export function AuthDivider() {
    return (
        <div className='relative my-4'>
            <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-card px-2 text-muted-foreground'>Or continue with</span>
            </div>
        </div>
    );
}
