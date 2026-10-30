import { devices, expect, test } from '@playwright/test'

// El panel tiene un respaldo que vuelve a pedir los datos cada 30 s. Si
// el cambio llega en menos de 5 s y sin recargar, llegó por tiempo real.
const EN_VIVO = { timeout: 5000 }

test('reservar en el celular cambia el panel en vivo', async ({ browser }) => {
  const compu = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const panel = await compu.newPage()
  await panel.goto('/panel')
  await expect(panel.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible()
  await panel.evaluate(() => {
    window.sinRecargar = true
  })

  const enVivo = panel.getByRole('region', { name: /Clase en vivo/ })
  await expect(enVivo.getByTestId('reservas')).toHaveText('0 de 20')
  await expect(enVivo.getByTestId('confirmados')).toHaveText('0 de 20')

  const celular = await browser.newContext({ ...devices['Pixel 7'] })
  const cel = await celular.newPage()
  await cel.goto('/clases')

  const tarjeta = cel.getByRole('listitem').filter({ hasText: 'Clase en vivo' })
  await tarjeta.getByRole('button', { name: 'Reservar' }).click()
  await expect(tarjeta.getByText('Reservada')).toBeVisible()

  const avatar = cel.getByRole('link', { name: /Mis reservas/ })
  await expect(avatar).toHaveAttribute('title', /^Alumn[ao] \d+$/)
  const nombre = await avatar.getAttribute('title')

  await expect(enVivo.getByTestId('reservas')).toHaveText('1 de 20', EN_VIVO)
  await expect(enVivo.getByText(nombre, { exact: true })).toBeVisible()

  await tarjeta.getByRole('link', { name: 'Clase en vivo' }).click()
  await cel.getByRole('link', { name: 'Ver mi reserva' }).click()
  await expect(cel.getByText('Confirmación pendiente')).toBeVisible()
  await cel.getByRole('button', { name: 'Confirmo' }).click()
  await expect(cel.getByText('Confirmada', { exact: true })).toBeVisible()

  await expect(enVivo.getByTestId('confirmados')).toHaveText('1 de 20', EN_VIVO)

  await cel.getByRole('button', { name: 'Liberar mi lugar' }).click()
  await expect(cel.getByText('Todavía no tenés reservas')).toBeVisible()

  await expect(enVivo.getByTestId('reservas')).toHaveText('0 de 20', EN_VIVO)
  await expect(enVivo.getByText(nombre, { exact: true })).toHaveCount(0)

  expect(await panel.evaluate(() => window.sinRecargar)).toBe(true)
})
