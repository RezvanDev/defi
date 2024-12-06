document.addEventListener('DOMContentLoaded', function() {
   const tg = window.Telegram.WebApp;
   const createWithdrawalBtn = document.getElementById('createWithdrawal');
   const withdrawForm = document.querySelector('.wallet');
   const withdrawalInfo = document.getElementById('withdrawalInfo');

   tg.BackButton.show();
   tg.BackButton.onClick(() => {
       window.location.href = '/wallet';
   });

   createWithdrawalBtn.addEventListener('click', function() {
       const amount = document.getElementById('withdrawAmount').value;
       const address = document.getElementById('withdrawAddress').value;

       fetch('/withdraw', {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
           },
           body: JSON.stringify({amount: amount, address: address}),
       })
       .then(response => response.json())
       .then(data => {
           if (data.success) {
               withdrawForm.style.display = 'none';
               withdrawalInfo.style.display = 'block';
               document.getElementById('amountToWithdraw').textContent = amount;
               document.getElementById('withdrawalAddress').textContent = address;


               const balanceElement = document.getElementById('withdrawalBalance');
               const newBalance = parseFloat(balanceElement.textContent) - parseFloat(amount);
               balanceElement.textContent = newBalance.toFixed(2);

               alert(data.message);
           } else {
               alert(data.message);
           }
       })
       .catch((error) => {
           console.error('Error:', error);
           alert('Произошла ошибка при создании запроса на вывод');
       });
   });


   tg.expand();
   tg.enableClosingConfirmation();
});