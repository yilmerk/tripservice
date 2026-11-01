// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DestinationForm, PlaceForm, TripForm } from '../src/components/TripForms';

afterEach(cleanup);
function expectNoLocationInputs() {
  expect(screen.queryByRole('combobox', { name: /haritada/i })).toBeNull();
  for (const name of ['Adres', 'Enlem', 'Boylam', 'Haritada yer ara']) {
    expect(screen.queryByLabelText(name)).toBeNull();
  }
}
it('saves hotel information without requesting an address or coordinates', async () => {
  const save = vi.fn(); const user = userEvent.setup();
  render(<DestinationForm busy={false} onSave={save}/>);
  expectNoLocationInputs();
  await user.type(screen.getByLabelText('Şehir'), 'Roma');
  await user.type(screen.getByLabelText('Ülke'), 'İtalya');
  await user.type(screen.getByLabelText('Otel adı'), 'Roma Otel');
  await user.type(screen.getByLabelText('Rezervasyon kodu'), 'ABC123');
  await user.click(screen.getByRole('button', { name: 'Şehri kaydet' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ city: 'Roma', country: 'İtalya', hotels: [expect.objectContaining({ name: 'Roma Otel', reservationCode: 'ABC123' })] }));
  expect(save.mock.calls[0][0].hotels[0]).not.toHaveProperty('location');
  expect(save.mock.calls[0][0].hotels[0]).not.toHaveProperty('address');
});
it('edits a visited place without location inputs and preserves its details', async () => {
  const save = vi.fn(); const user = userEvent.setup();
  render(<PlaceForm busy={false} place={{ id: 'cafe', name: 'Kafe', category: 'coffee', visited: true, mustVisit: true, famousFor: 'Espresso', fee: { amount: 3, currency: 'EUR' } }} onSave={save}/>);
  expectNoLocationInputs();
  await user.click(screen.getByRole('button', { name: 'Değişiklikleri kaydet' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kafe', category: 'coffee', visited: true, mustVisit: true, famousFor: 'Espresso', fee: { amount: 3, currency: 'EUR' } }));
  expect(save.mock.calls[0][0]).not.toHaveProperty('location');
  expect(save.mock.calls[0][0]).not.toHaveProperty('address');
});

it('creates a trip with a target budget and default currency', async () => {
  const save = vi.fn(); const user = userEvent.setup(); render(<TripForm busy={false} onSave={save}/>);
  await user.type(screen.getByLabelText('Seyahat adı'), 'Londra');
  await user.type(screen.getByLabelText('Hedef bütçe (isteğe bağlı)'), '750');
  await user.selectOptions(screen.getByLabelText('Varsayılan para birimi'), 'GBP');
  await user.click(screen.getByRole('button', { name: 'Seyahati oluştur' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Londra', totalBudget: 750, currency: 'GBP' }));
});
