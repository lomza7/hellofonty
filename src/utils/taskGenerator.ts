import { supabase } from '../lib/supabase';

export type TaskType =
  | 'NEW_BOOKING_REQUEST'
  | 'UNREAD_MESSAGES'
  | 'UPCOMING_PAYMENT'
  | 'COMPLETE_PROFILE'
  | 'VERIFY_EMAIL'
  | 'CREATE_ACCESS_GUIDE'
  | 'SIGN_LEASE'
  | 'SCHEDULE_INVENTORY'
  | 'ACCEPT_BOOKING';

interface GenerateTaskParams {
  userId: string;
  taskType: TaskType;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function generateTask(params: GenerateTaskParams) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-task`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to generate task');
    }

    return result;
  } catch (error) {
    console.error('Error generating task:', error);
    throw error;
  }
}

export async function generateTasksForNewBooking(bookingId: string, landlordId: string, studentId: string) {
  try {
    await Promise.all([
      generateTask({
        userId: landlordId,
        taskType: 'NEW_BOOKING_REQUEST',
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
      }),
      generateTask({
        userId: studentId,
        taskType: 'COMPLETE_PROFILE',
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
      }),
    ]);
  } catch (error) {
    console.error('Error generating booking tasks:', error);
  }
}

export async function generatePaymentTask(paymentId: string, studentId: string) {
  try {
    await generateTask({
      userId: studentId,
      taskType: 'UPCOMING_PAYMENT',
      relatedEntityType: 'payment',
      relatedEntityId: paymentId,
    });
  } catch (error) {
    console.error('Error generating payment task:', error);
  }
}

export async function checkAndGenerateUnreadMessagesTasks(userId: string) {
  try {
    const { data: messages } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('receiver_id', userId)
      .eq('read', false);

    if (!messages || messages.length === 0) return;

    const oldestMessage = messages.reduce((oldest, msg) => {
      return new Date(msg.created_at) < new Date(oldest.created_at) ? msg : oldest;
    });

    const messageAge = Date.now() - new Date(oldestMessage.created_at).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (messageAge > twentyFourHours) {
      await generateTask({
        userId,
        taskType: 'UNREAD_MESSAGES',
        relatedEntityType: 'message',
        relatedEntityId: oldestMessage.id,
      });
    }
  } catch (error) {
    console.error('Error checking unread messages:', error);
  }
}
