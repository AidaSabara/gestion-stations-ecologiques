import * as bcrypt from 'bcrypt';

export class PasswordUtil {
  private static readonly SALT_ROUNDS = 12;

  static async hash(plainPassword: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
    return await bcrypt.hash(plainPassword, salt);
  }

  static async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}
