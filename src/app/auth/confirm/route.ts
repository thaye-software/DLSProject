import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { users } from '@/database/schema'
import { db } from '@/database/drizzle'

export async function GET(request: NextRequest) {
  console.log('========== AUTH CONFIRM ROUTE HIT ==========')
  
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('Query params:', { token_hash: !!token_hash, type, code: !!code, next })

  if (token_hash && type) {
    console.log('Processing token_hash flow with type:', type)
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    
    console.log('VerifyOtp result:', { error: error?.message })
    
    if (!error) {
      console.log('OTP verified successfully, checking if email_change...')
      
      if (type === 'email_change') {
        console.log('Type is email_change, fetching user...')
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        console.log('User fetch result:', { 
          userId: user?.id, 
          email: user?.email, 
          error: userError?.message 
        })
        
        if (user && user.email) {
          console.log('Attempting to update public.users table...')
          try {
            const result = await db
              .update(users)
              .set({ email: user.email })
              .where(eq(users.id, user.id))
              .returning()
            
            console.log('✅ Successfully synced email:', result)
          } catch (dbError) {
            console.error('❌ Failed to sync email to public.users:', dbError)
          }
        } else {
          console.log('⚠️ No user or email found, skipping sync')
        }
      } else {
        console.log('Type is NOT email_change, skipping sync')
      }
      
      console.log('Redirecting to:', next)
      redirect(next)
    } else {
      console.log('VerifyOtp failed, not syncing email')
    }
  }

  if (code) {
    console.log('Processing code exchange flow')
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('Code exchange result:', { error: error?.message })
    
    if (!error) {
      console.log('Code exchange successful, redirecting to:', next)
      redirect(next)
    }
  }

  console.log('No valid token or code, redirecting to /error')
  redirect('/error')
}