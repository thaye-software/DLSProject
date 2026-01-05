import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { users } from '@/database/schema'
import { db } from '@/database/drizzle'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    
    if (!error) {
      if (type === 'email_change') {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user && user.email) {
          try {
            await db
              .update(users)
              .set({ email: user.email })
              .where(eq(users.id, user.id))
            
            console.log(`Successfully synced email for user ${user.id} to ${user.email}`)
          } catch (dbError) {
            console.error('Failed to sync email to public.users:', dbError)
          }
        }
      }
      
      redirect(next)
    }
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      redirect(next)
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/error')
}